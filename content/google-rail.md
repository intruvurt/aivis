# Google AIO citation selection (from patents + Search Central docs)

def score_for_aio_citation(page, query):
    signals = {
        # These are the actual documented signals:
        "passage_relevance": semantic_match(query, extract_passages(page)),
        "page_quality": E_E_A_T_score(page),  # Experience, Expertise, Authority, Trust
        "schema_markup": json_ld_completeness(page),
        "direct_answer_blocks": detect_answer_style_paragraphs(page),
        "breadcrumb_clarity": parse_breadcrumbs(page),
        "freshness": days_since_last_crawl(page),
        
        # Less obvious signals:
        "internal_link_graph": site_architecture_depth(page),
        "query_to_title_match": semantic_overlap(query, page.title + page.h1),
        "cited_by_others": count_pages_linking_to(page.url),
    }
    
    # AIO selects the 3-5 sources that together cover the query
    # with minimum overlap — it prefers DIVERSE citations over
    # one great source repeated. This means specialization wins.
    # If aivis.biz owns "AI visibility scoring" as a concept,
    # it gets cited even over higher-DA sites for that specific query.