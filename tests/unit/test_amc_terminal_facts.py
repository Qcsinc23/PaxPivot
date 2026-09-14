"""TASK-048: the terminal-page operating-facts parser reads only what the page states.

Every fixture below is synthetic HTML modelled structurally on the shared AFPIMS/DNN template
the four real AMC terminal pages use (a "Contact Information" module, a "Service Counter"
heading, "Email:"/"Hours of operation:" labels, and free-text "Local Travel Information"
content) — no real page body is reproduced here (paxpivot.md §16.2, TASK-031 README).
"""

from paxpivot.application.parsers.amc_terminal_facts import (
    MAX_FACT_LENGTH,
    PARSER_VERSION,
    ParsedFact,
    parse_terminal_facts,
)
from paxpivot.domain.terminal import TerminalFactKind

FULL_PAGE = """
<html><body>
<div class="col-md-3">
<h2 class="theme-container-header"><span class="title">Contact Information</span></h2>
<div class="ModuleContent"><div class="Normal">
<p><strong>Example Terminal Passenger Terminal</strong><br>
100 Example Ave<br>
Example City, EX&nbsp;00001<br>
<br>
<strong>Service Counter<br>
Comm:&nbsp;</strong>555-100-2000<br>
<strong>DSN:</strong>&nbsp;100-2000<br></p>
<p><strong>Comm Fax:</strong> 555-100-2001</p>
<p><strong>Email:</strong>&nbsp;<br>
pax.example@us.af.mil<br>
<br>
<strong>Hours of operation:</strong>&nbsp;Effective 1 Jan 2026 terminal hours are 0700-0000</p>
</div></div>
</div>
<div class="col-md-9">
<h2><span class="title">Welcome to the Example Terminal</span></h2>
<div class="ModuleContent"><div class="Normal">
<p><strong>Duty Passengers</strong></p>
<p>Check in at the counter well before roll call.</p>
</div></div>
<h2><span class="title">Local Travel Information</span></h2>
<div class="ModuleContent"><div class="Normal">
<p><strong>USO Information</strong></p>
<p>The USO is located on your immediate left upon entering the passenger terminal.</p>
<p>Hours:</p>
<ul>
 <li>Monday - Friday:&nbsp;0800 - 2000</li>
 <li>Saturday - Sunday:&nbsp;0800 - 1700</li>
</ul>
<p>All passengers are advised that long term parking is 7 days or greater.</p>
<p>Short term parking is authorized for up to 6 days at the passenger lot.</p>
<p><span style="font-size:larger;"><b>This is a card-only terminal.
Cash will not be accepted.</b></span></p>
</div></div>
</div>
</body></html>
"""


def _kinds(document: str) -> dict[TerminalFactKind, str]:
    return {f.kind: f.value for f in parse_terminal_facts(document)}


def test_every_kind_is_read_from_a_full_page() -> None:
    facts = _kinds(FULL_PAGE)
    assert facts[TerminalFactKind.PASSENGER_TERMINAL_NOTE] == (
        "Example Terminal Passenger Terminal, 100 Example Ave, Example City, EX 00001"
    )
    assert (
        facts[TerminalFactKind.PHONE] == "Comm: 555-100-2000; DSN: 100-2000; Comm Fax: 555-100-2001"
    )
    assert facts[TerminalFactKind.EMAIL] == "pax.example@us.af.mil"
    assert facts[TerminalFactKind.COUNTER_HOURS] == (
        "Effective 1 Jan 2026 terminal hours are 0700-0000"
    )
    assert facts[TerminalFactKind.USO_AVAILABILITY] == (
        "The USO is located on your immediate left upon entering the passenger terminal. "
        "Hours: Monday - Friday: 0800 - 2000 Saturday - Sunday: 0800 - 1700"
    )
    assert facts[TerminalFactKind.PARKING] == (
        "All passengers are advised that long term parking is 7 days or greater. "
        "Short term parking is authorized for up to 6 days at the passenger lot."
    )
    assert facts[TerminalFactKind.ACCESS_NOTE] == (
        "This is a card-only terminal. Cash will not be accepted."
    )
    assert len(facts) == 7


def test_parser_is_pure_and_deterministic() -> None:
    first = parse_terminal_facts(FULL_PAGE)
    second = parse_terminal_facts(FULL_PAGE)
    assert first == second
    assert PARSER_VERSION == "amc-terminal-facts-v1"


# ---- Absent facts: a page that carries none of a given kind yields nothing for it -------------

MINIMAL_PAGE = """
<html><body>
<h2><span class="title">Contact Information</span></h2>
<div class="ModuleContent"><div class="Normal">
<p><strong>Example Terminal Passenger Terminal</strong><br>
100 Example Ave<br>
Example City, EX&nbsp;00001<br>
<br>
<strong>Service Counter<br>
Comm:&nbsp;</strong>555-100-2000<br>
<strong>Email:</strong>&nbsp;<br>
pax.example@us.af.mil<br>
<br>
<strong>Hours of operation:</strong>&nbsp;0800-2400</p>
</div></div>
<h2><span class="title">Welcome to the Example Terminal</span></h2>
<div class="ModuleContent"><div class="Normal">
<p>A plain welcome paragraph with no other notices at all.</p>
</div></div>
</body></html>
"""


def test_a_page_with_no_uso_parking_or_access_note_yields_nothing_for_those_kinds() -> None:
    facts = _kinds(MINIMAL_PAGE)
    assert set(facts) == {
        TerminalFactKind.PASSENGER_TERMINAL_NOTE,
        TerminalFactKind.PHONE,
        TerminalFactKind.EMAIL,
        TerminalFactKind.COUNTER_HOURS,
    }


def test_a_page_with_no_contact_information_module_yields_no_address_phone_email_or_hours() -> None:
    document = "<html><body><p>Just a welcome paragraph, no contact block at all.</p></body></html>"
    assert parse_terminal_facts(document) == []


# ---- Ambiguous / malformed values: never a guess -----------------------------------------------


def test_an_email_label_with_no_recognisable_address_nearby_is_ambiguous() -> None:
    document = """
    <h2><span class="title">Contact Information</span></h2>
    <p><strong>Email:</strong> see the front desk<br>
    <strong>Hours of operation:</strong> 0800-2400</p>
    """
    facts = _kinds(document)
    assert TerminalFactKind.EMAIL not in facts
    assert facts[TerminalFactKind.COUNTER_HOURS] == "0800-2400"


def test_an_inline_email_on_the_same_line_as_the_label_is_read_too() -> None:
    # The Dover-style template puts the address inline after the label (a link's anchor text is
    # inline, not on its own line via <br>), rather than on the following line.
    document = """
    <h2><span class="title">Contact Information</span></h2>
    <p><strong>E-Mail:</strong>&nbsp;<a href="mailto:pax@us.af.mil">pax@us.af.mil</a><br>
    <strong>Hours of Operation:</strong>&nbsp;0800-2400</p>
    """
    facts = _kinds(document)
    assert facts[TerminalFactKind.EMAIL] == "pax@us.af.mil"


def test_an_hours_label_with_empty_content_yields_nothing() -> None:
    document = """
    <h2><span class="title">Contact Information</span></h2>
    <p><strong>Hours of operation:</strong></p>
    """
    assert parse_terminal_facts(document) == []


def test_a_service_counter_heading_with_no_phone_lines_after_it_yields_nothing() -> None:
    document = """
    <h2><span class="title">Contact Information</span></h2>
    <p><strong>Service Counter</strong></p>
    <p><strong>Email:</strong> pax@us.af.mil</p>
    """
    facts = _kinds(document)
    assert TerminalFactKind.PHONE not in facts
    assert facts[TerminalFactKind.EMAIL] == "pax@us.af.mil"


def test_a_contact_block_with_no_recognised_stop_label_yields_no_address_beyond_the_line_cap() -> (
    None
):
    # No "Service Counter"/"Email:"/"Hours of operation:" label ever appears: the collection
    # is capped, never unbounded, and never silently swallows the rest of the page.
    document = "<h2><span class='title'>Contact Information</span></h2>" + "".join(
        f"<p>line {i}</p>" for i in range(10)
    )
    facts = _kinds(document)
    assert facts[TerminalFactKind.PASSENGER_TERMINAL_NOTE] == "line 0, line 1, line 2, line 3"


# ---- Length bound: never invents by truncating mid-sentence ------------------------------------


def test_a_value_over_the_length_bound_is_dropped_not_truncated() -> None:
    too_long_hours = f"""
    <h2><span class="title">Contact Information</span></h2>
    <p><strong>Hours of operation:</strong> {"x" * (MAX_FACT_LENGTH + 1)}</p>
    """
    assert parse_terminal_facts(too_long_hours) == []


def test_parking_run_is_trimmed_to_the_bound_by_whole_lines_never_mid_sentence() -> None:
    # Two "parking" lines where only the first fits under the bound: the second whole line is
    # dropped rather than truncating the run mid-sentence.
    first_line = "Parking notice: " + ("a" * (MAX_FACT_LENGTH - 20))
    second_line = "Additional parking rules apply on weekends."
    document = f"""
    <h2><span class="title">Contact Information</span></h2>
    <p>{first_line}</p>
    <p>{second_line}</p>
    """
    facts = _kinds(document)
    assert facts[TerminalFactKind.PARKING] == first_line
    assert len(facts[TerminalFactKind.PARKING]) <= MAX_FACT_LENGTH


def test_only_the_first_contiguous_parking_run_on_the_page_is_read() -> None:
    document = """
    <p>Parking is available in lot A.</p>
    <p>Unrelated paragraph about check-in.</p>
    <p>Parking is also available in lot B, mentioned later on the page.</p>
    """
    facts = _kinds(document)
    assert facts[TerminalFactKind.PARKING] == "Parking is available in lot A."


# ---- Provenance shape: each fact keeps a short verbatim span ------------------------------------


def test_every_returned_value_is_a_short_bounded_verbatim_span() -> None:
    for fact in parse_terminal_facts(FULL_PAGE):
        assert isinstance(fact, ParsedFact)
        assert 0 < len(fact.value) <= MAX_FACT_LENGTH
        assert fact.value == fact.value.strip()
