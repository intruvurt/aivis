# ChatGPT Citation Rail - Evidence-First Audit Engine

This is an **evidence-first audit engine**, not just pattern matching. No guessing, no silent assumptions. Every score must trace back to something observable.

Surgical version.

---

## Step 1: Deterministic Fetch Layer (No Illusions)

```text
input: url

fetch_modes = [
  raw_html,          // direct GET (no JS)
  prerender_probe,   // check if static snapshot exists
  headers_only       // for signals like caching, server type
]

output = {
  html,
  headers,
  status,
  final_url,
  fetch_confidence   // was content complete or partial?
}
```

Key difference:
You don’t pretend you saw the page if JS hid it.

You **grade visibility based on what AI actually sees**, not what users see.

---

## Step 2: Evidence Extraction (Everything Gets an ID)

No scoring yet. Just extraction.

```text
evidence = {
  ev_title,
  ev_meta_description,
  ev_h1: [],
  ev_h2: [],
  ev_jsonld: [],
  ev_og_tags,
  ev_canonical,
  ev_internal_links: [],
  ev_external_links: [],
  ev_named_entities: [],
  ev_faq_blocks,
  ev_author,
  ev_contact,
  ev_policies,
  ev_claims: [],        // sentences making assertions
  ev_numbers: [],       // stats, data points
}
```

Each item:

```text
{
  id: "ev_h1_1",
  value: "...",
  source_offset: [start, end],
  confidence: 1.0
}
```

If it doesn’t exist → it’s not inferred → it’s **missing**.

---

## Step 3: Entity Graph Reconstruction

This is where most tools fake it.

You don’t just check “is there schema.”
You rebuild what AI *thinks the entity is*.

```text
entity = {
  name_candidates: [title, h1, og:title],
  resolved_name,
  type_guess,           // org, product, person, unknown
  consistency_score,
  disambiguation_score,
}
```

If the name shifts across tags → penalty
If no clear entity → major penalty

---

## Step 4: Query Simulation Layer (Real AEO, not SEO cosplay)

Instead of generic scoring, simulate:

```text
queries = generate_queries(entity, page_content)

for q in queries:
  check:
    - direct answer present?
    - answer format (sentence, list, definition)
    - location (above fold vs buried)
```

This produces:

```text
answerability_score = {
  directness,
  completeness,
  extractability
}
```

This is what determines if LLMs will *lift* your content.

---

## Step 5: Citation Probability Modeling

Not “does it have links”

But:

```text
citation_surface = f(
  claim_density,
  named_entity_density,
  outbound_authority_links,
  structural clarity,
  uniqueness_of_statements
)
```

Then:

```text
citation_probability = sigmoid(weighted_sum(citation_surface))
```

You’re estimating:

> “Would an AI model quote this?”

---

## Step 6: Trust & Verifiability Layer

Hard checks, not vibes:

```text
trust = {
  has_author_entity,
  has_org_entity,
  has_contact_surface,
  has_policy_surface,
  external_validation: detect_mentions(entity.name),
  claim_backing_ratio: supported_claims / total_claims
}
```

Missing → explicitly flagged, not averaged away.

---

## Step 7: Noise vs Signal (Compression Test)

Instead of subjective fluff scoring:

```text
signal_units = count(facts + entities + claims + numbers)
total_units  = total_sentences

noise_to_signal = total_units / signal_units
```

High ratio = diluted page = lower extraction priority.

---

## Step 8: Final Scoring (Non-Averaged, Gated)

No simple averages.

You gate:

```text
if missing(ev_h1):
  cap_score(<=60)

if no_entity_resolved:
  cap_score(<=50)

if no_answer_blocks:
  cap_score(<=65)
```

Then weighted scoring:

```text
score = weighted({
  entity_resolution,
  answerability,
  citation_probability,
  trust,
  schema_integrity,
  signal_density
})
```

---

## Step 9: Fixpack Engine (Where Most Tools Stop Short)

Instead of “recommendations,” you output:

```text
fixpack = [
  {
    issue: "No resolvable entity",
    evidence: [],
    required_action: "Add JSON-LD Organization with sameAs + name match",
    expected_score_delta: +18
  },
  {
    issue: "Low answer extractability",
    evidence: [ev_h2_3],
    required_action: "Convert section into direct Q/A block",
    expected_score_delta: +12
  }
]
```

Every fix:

* tied to evidence
* tied to score impact
* executable

---

## The Real Difference

What you wrote = **pattern detection engine**

What I’m describing = **audit-grade inference system with constraints**

No hallucinated fills
No silent assumptions
No “it probably means this”

If the page doesn’t prove it → it doesn’t count
If it doesn’t count → it drags the score
If it drags the score → it generates a fix tied to revenue impact

---

If you push this all the way, you stop being an “AI SEO tool”

You become:

> a visibility compiler
> input: messy web page
> output: machine-readable authority

That’s where the leverage is.
