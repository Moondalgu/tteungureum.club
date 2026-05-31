# -*- coding: utf-8 -*-
"""
뜬구름클럽 - PC 카카오톡 오픈채팅 수집기

PC 카카오톡(데스크톱 앱)의 특정 오픈채팅방 창에서 새 메시지를 읽어
웹 백엔드(/api/ingest)로 주제(글쓴이/날짜/내용)를 전송합니다.

⚠️ 주의
- 사설 자동화는 카카오 약관 위반 소지가 있습니다. 가급적 '부계정'으로 운영하세요.
- 읽기 방식은 PC 카톡 UI 구조(uiautomation)에 의존하므로, 카톡 업데이트로
  컨트롤 구조가 바뀌면 selector 조정이 필요할 수 있습니다.
- 먼저 `python kakao_reader.py --dump` 로 창/컨트롤 트리를 확인해
  room_name 이 실제 창 제목과 일치하는지 점검하세요.

사용법
  1) pip install -r requirements.txt
  2) config.example.json -> config.json 으로 복사 후 값 채우기
  3) PC 카톡에서 대상 오픈채팅방 창을 '별도 창'으로 열어두기
  4) python kakao_reader.py            # 폴링 시작
     python kakao_reader.py --dump     # 컨트롤 트리 디버그 출력
     python kakao_reader.py --once     # 1회만 수집
"""

import json
import os
import sys
import time
import hashlib
import datetime
import requests

try:
    import uiautomation as auto
except ImportError:
    print("uiautomation 이 없습니다. `pip install -r requirements.txt` 를 실행하세요.")
    sys.exit(1)

HERE = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(HERE, "config.json")
STATE_PATH = os.path.join(HERE, "state.json")


def load_config():
    if not os.path.exists(CONFIG_PATH):
        print("config.json 이 없습니다. config.example.json 을 복사해 만드세요.")
        sys.exit(1)
    with open(CONFIG_PATH, encoding="utf-8") as f:
        return json.load(f)


def load_state():
    if os.path.exists(STATE_PATH):
        with open(STATE_PATH, encoding="utf-8") as f:
            return set(json.load(f).get("seen", []))
    return set()


def save_state(seen):
    # 최근 2000개만 보관
    arr = list(seen)[-2000:]
    with open(STATE_PATH, "w", encoding="utf-8") as f:
        json.dump({"seen": arr}, f, ensure_ascii=False)


def hash_msg(author, content):
    return hashlib.sha256(f"{author}::{content}".encode("utf-8")).hexdigest()


def find_room_window(room_name):
    """room_name 을 제목에 포함하는 카카오톡 채팅방 창 찾기."""
    # 카카오톡 채팅방은 보통 방 이름을 제목으로 하는 별도 창으로 열림
    win = auto.WindowControl(searchDepth=1, RegexName=f".*{room_name}.*")
    if win.Exists(maxSearchSeconds=2):
        return win
    return None


def dump_tree(room_name):
    print(f"[dump] '{room_name}' 창 탐색...")
    win = find_room_window(room_name)
    if not win:
        print("창을 찾지 못했습니다. 카톡에서 해당 방을 '새 창'으로 열어두세요.")
        print("현재 열린 최상위 창 목록:")
        for w in auto.GetRootControl().GetChildren():
            if w.Name:
                print("  -", repr(w.Name), w.ClassName)
        return
    print("찾음:", repr(win.Name), win.ClassName)
    print("--- 컨트롤 트리 (깊이 6) ---")
    for ctrl, depth in auto.WalkControl(win, maxDepth=6):
        name = (ctrl.Name or "").strip()
        if name:
            print("  " * depth, ctrl.ControlTypeName, repr(name[:80]))


def collect_messages(win):
    """채팅방 창에서 메시지 텍스트(ListItem) 추출.
    카톡 버전에 따라 구조가 달라 ListItem / Text 를 모두 시도."""
    results = []
    # 1) ListItemControl 우선 (각 말풍선)
    for ctrl, _ in auto.WalkControl(win, maxDepth=12):
        if ctrl.ControlTypeName == "ListItemControl":
            name = (ctrl.Name or "").strip()
            if name:
                results.append(name)
    return results


def parse_item(text, author_default):
    """ListItem 텍스트를 (author, content) 로 분리(휴리스틱).
    카톡은 보통 '보낸사람 메시지내용 오전/오후 hh:mm' 형태로 Name 을 노출.
    구조가 다르면 author_default 로 처리."""
    content = text
    author = author_default
    # 시간 꼬리표 제거
    for marker in ["오전 ", "오후 "]:
        idx = content.rfind(marker)
        if idx > 0:
            content = content[:idx].strip()
            break
    # '보낸사람\n내용' 또는 '보낸사람 : 내용' 패턴 추출 시도
    if "\n" in content:
        head, rest = content.split("\n", 1)
        if 0 < len(head) <= 20:
            author, content = head.strip(), rest.strip()
    return author, content


def is_reply_to_notice(text, notice_keyword):
    """공지(notice_keyword)를 인용한 대댓글로 보이는지 휴리스틱 판정."""
    if not notice_keyword:
        return True
    return notice_keyword in text


def send_items(cfg, items):
    if not items:
        return 0
    payload = {"items": items}
    try:
        res = requests.post(
            cfg["api_url"],
            json=payload,
            headers={"Authorization": f"Bearer {cfg['secret']}"},
            timeout=15,
        )
        if res.status_code == 200:
            return res.json().get("inserted", 0)
        print("[전송 실패]", res.status_code, res.text[:200])
    except Exception as e:
        print("[전송 오류]", e)
    return 0


def run_once(cfg, seen):
    win = find_room_window(cfg["room_name"])
    if not win:
        print("채팅방 창을 찾지 못했습니다. 방을 새 창으로 열어두세요.")
        return seen
    win.SetActive()
    time.sleep(0.3)

    today = datetime.date.today().isoformat()
    texts = collect_messages(win)
    new_items = []
    for t in texts:
        if not is_reply_to_notice(t, cfg.get("notice_keyword", "")):
            continue
        author, content = parse_item(t, cfg.get("author_default", "익명"))
        if not content:
            continue
        h = hash_msg(author, content)
        if h in seen:
            continue
        seen.add(h)
        new_items.append(
            {"author": author, "content": content, "source_date": today}
        )

    inserted = send_items(cfg, new_items)
    if new_items:
        print(f"[{time.strftime('%H:%M:%S')}] 감지 {len(new_items)}건, 신규저장 {inserted}건")
        save_state(seen)
    return seen


def main():
    cfg = load_config()
    args = sys.argv[1:]

    if "--dump" in args:
        dump_tree(cfg["room_name"])
        return

    seen = load_state()

    if "--once" in args:
        run_once(cfg, seen)
        return

    interval = int(cfg.get("poll_interval", 8))
    print(f"수집 시작: '{cfg['room_name']}' (주기 {interval}s). 종료는 Ctrl+C")
    try:
        while True:
            seen = run_once(cfg, seen)
            time.sleep(interval)
    except KeyboardInterrupt:
        print("\n종료합니다.")
        save_state(seen)


if __name__ == "__main__":
    main()
