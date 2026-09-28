from app.services.citation_parser import pages_from_citation, parse_cited_answer, strip_markdown
from tests.conftest import cited, plain


def test_page_location_end_is_exclusive():
    assert pages_from_citation(
        {"type": "page_location", "start_page_number": 4, "end_page_number": 5}
    ) == [4]
    assert pages_from_citation(
        {"type": "page_location", "start_page_number": 4, "end_page_number": 6}
    ) == [4, 5]


def test_degenerate_end_page_falls_back_to_start():
    assert pages_from_citation(
        {"type": "page_location", "start_page_number": 3, "end_page_number": 3}
    ) == [3]


def test_non_page_citations_ignored():
    assert pages_from_citation({"type": "char_location", "start_char_index": 0}) == []
    assert pages_from_citation({"type": "page_location", "start_page_number": 0}) == []


def test_parses_cited_and_uncited_blocks():
    parts = parse_cited_answer(
        [
            plain("Here is what your notes say:\n\n"),
            cited("A stack is last-in, first-out.", 4),
            plain(" "),
            cited("A queue is first-in, first-out.", 5, 7),
        ]
    )
    assert [p.model_dump() for p in parts] == [
        {"text": "Here is what your notes say:\n\n", "pages": []},
        {"text": "A stack is last-in, first-out. ", "pages": [4]},
        {"text": "A queue is first-in, first-out.", "pages": [5, 6]},
    ]


def test_merges_consecutive_uncited_blocks_and_skips_non_text():
    parts = parse_cited_answer(
        [
            {"type": "thinking", "thinking": "..."},
            plain("Your notes "),
            plain("don't cover this."),
        ]
    )
    assert [p.model_dump() for p in parts] == [
        {"text": "Your notes don't cover this.", "pages": []}
    ]


def test_multiple_citations_on_one_block_are_deduplicated():
    block = cited("Both.", 2)
    block.citations = block.citations + cited("x", 2).citations + cited("y", 9).citations
    assert parse_cited_answer([block])[0].pages == [2, 9]


def test_empty_content():
    assert parse_cited_answer([]) == []


def test_strips_bold_markers_and_headings_seen_in_production():
    # Shape observed from the live API: bold headings between cited blocks.
    parts = parse_cited_answer(
        [
            cited("Stacks are LIFO.", 2),
            plain(" This matters.\n\n**Order of Operations:**\n\n"),
            cited("push adds to the top.", 2),
            plain("\n\n## Real-World Uses\n"),
            cited("Queues serve BFS.", 3),
        ]
    )
    text = "".join(p.text for p in parts)
    assert "**" not in text and "##" not in text
    assert "Order of Operations:" in text and "Real-World Uses" in text
    assert [p.pages for p in parts if p.pages] == [[2], [2], [3]]


def test_strip_markdown_keeps_meaningful_symbols():
    assert strip_markdown("a * b and x ** 2") == "a * b and x ** 2"
    assert strip_markdown("**Key idea:** stacks are **LIFO**.") == "Key idea: stacks are LIFO."
    assert strip_markdown("Python's __init__ method") == "Python's __init__ method"
    assert strip_markdown("Use C# or #hashtag") == "Use C# or #hashtag"
