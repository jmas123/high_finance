from rapidfuzz import process

def match_entity(entity_name, entity_list):
    """
    Match an entity name against a list of entities using fuzzy matching.

    Args:
        entity_name (str): The name of the entity to match.
        entity_list (list): A list of entity names to match against.

    Returns:
        str: The best matching entity name from the list.
    """
    match, score = process.extractOne(entity_name, entity_list)
    return match if score > 80 else None

def normalize_name(name):
    """
    Normalize a name by converting it to lowercase and stripping whitespace.

    Args:
        name (str): The name to normalize.

    Returns:
        str: The normalized name.
    """
    return name.lower().strip()