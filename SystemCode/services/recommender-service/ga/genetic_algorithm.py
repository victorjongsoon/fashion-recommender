import os
import random
import pandas as pd
import numpy as np

# --- Configuration via environment variables ---
W1 = float(os.environ.get("GA_W1", "0.3"))   # color lift
W2 = float(os.environ.get("GA_W2", "0.2"))   # pattern lift
W3 = float(os.environ.get("GA_W3", "0.2"))   # type lift
W4 = float(os.environ.get("GA_W4", "0.2"))   # dead stock bonus
W5 = float(os.environ.get("GA_W5", "0.1"))   # price penalty
W6 = float(os.environ.get("GA_W6", "0.15"))  # budget utilization bonus
W7 = float(os.environ.get("GA_W7", "0.3"))   # preferred color match
POPULATION_SIZE = int(os.environ.get("GA_POPULATION_SIZE", "50"))
GENERATIONS = int(os.environ.get("GA_GENERATIONS", "100"))
TOURNAMENT_SIZE = 3
CROSSOVER_RATE = 0.7
MUTATION_RATE = 0.2
SELECTION_TEMP = float(os.environ.get("GA_SELECTION_TEMP", "0.1"))
DEAD_STOCK_BONUS_SINGLE = 0.5
DEAD_STOCK_BONUS_BOTH = 1.0

# --- Lift lookup tables (loaded at startup) ---
_color_lift = {}
_pattern_lift = {}
_type_lift = {}


def _load_and_normalize_lift(csv_path: str, key_col_top: str, key_col_bottom: str) -> dict:
    """Load a lift CSV and return a dict of (top_attr, bottom_attr) -> normalized lift [0,1]."""
    try:
        df = pd.read_csv(csv_path)
    except FileNotFoundError:
        print(f"WARNING: Lift CSV not found: {csv_path}")
        return {}

    if df.empty or "lift" not in df.columns:
        return {}

    lift_min = df["lift"].min()
    lift_max = df["lift"].max()
    lift_range = lift_max - lift_min

    lookup = {}
    for _, row in df.iterrows():
        key = (str(row[key_col_top]), str(row[key_col_bottom]))
        if lift_range > 0:
            normalized = (row["lift"] - lift_min) / lift_range
        else:
            normalized = 0.0
        lookup[key] = normalized

    return lookup


def load_lift_tables(data_dir: str = "/data"):
    """Load all three lift CSV files and build normalized lookup dicts."""
    global _color_lift, _pattern_lift, _type_lift

    _color_lift = _load_and_normalize_lift(
        os.path.join(data_dir, "processed", "color_lift.csv"),
        "color_top", "color_bottom"
    )
    _pattern_lift = _load_and_normalize_lift(
        os.path.join(data_dir, "processed", "pattern_lift.csv"),
        "pattern_top", "pattern_bottom"
    )
    _type_lift = _load_and_normalize_lift(
        os.path.join(data_dir, "processed", "type_lift.csv"),
        "type_top", "type_bottom"
    )
    print(f"Loaded lift tables: color={len(_color_lift)}, pattern={len(_pattern_lift)}, type={len(_type_lift)}")


def fitness(candidate: dict, max_price: float, preferred_colors: set = None) -> float:
    """Evaluate fitness of a single candidate (top-bottom pair)."""
    # Lift lookups (default 0.0 for missing pairs)
    color_score = _color_lift.get((candidate["Top_Color"], candidate["Bottom_Color"]), 0.0)
    pattern_score = _pattern_lift.get((candidate["Top_Pattern"], candidate["Bottom_Pattern"]), 0.0)
    type_score = _type_lift.get((candidate.get("Top_Type", ""), candidate.get("Bottom_Type", "")), 0.0)

    # Preferred color match (soft): 0.0 / 0.5 / 1.0 based on how many of top/bottom match
    if preferred_colors:
        match_count = int(candidate.get("Top_Color") in preferred_colors) + \
                      int(candidate.get("Bottom_Color") in preferred_colors)
        pref_color_score = match_count / 2.0
    else:
        pref_color_score = 0.0

    # Dead stock bonus
    top_dead = candidate.get("Top_Stock_Status", "") == "Dead Stock"
    bottom_dead = candidate.get("Bottom_Stock_Status", "") == "Dead Stock"
    if top_dead and bottom_dead:
        dead_bonus = DEAD_STOCK_BONUS_BOTH
    elif top_dead or bottom_dead:
        dead_bonus = DEAD_STOCK_BONUS_SINGLE
    else:
        dead_bonus = 0.0

    # Price penalty (over budget) and budget utilization bonus (closer to budget = better)
    total_price = (candidate.get("Top_Price", 0.0) or 0.0) + (candidate.get("Bottom_Price", 0.0) or 0.0)
    if total_price > max_price:
        price_pen = (total_price - max_price) / max_price
        budget_util = 0.0  # no bonus if over budget
    else:
        price_pen = 0.0
        budget_util = min(total_price / max_price, 1.0) if max_price > 0 else 0.0

    return (
        W1 * color_score
        + W2 * pattern_score
        + W3 * type_score
        + W4 * dead_bonus
        - W5 * price_pen
        + W6 * budget_util
        + W7 * pref_color_score
    )


def _tournament_select(population: list, fitnesses: list) -> dict:
    """Select one individual via tournament selection."""
    indices = random.sample(range(len(population)), min(TOURNAMENT_SIZE, len(population)))
    best_idx = max(indices, key=lambda i: fitnesses[i])
    return population[best_idx].copy()


def _crossover(parent1: dict, parent2: dict) -> tuple:
    """Swap top or bottom between two parents."""
    child1 = parent1.copy()
    child2 = parent2.copy()
    if random.random() < 0.5:
        # Swap tops
        for col in ["Top_Article", "Top_Price", "Top_Color", "Top_Pattern", "Top_Stock_Status", "Top_Type", "Top_Occasion"]:
            child1[col], child2[col] = child2.get(col), child1.get(col)
    else:
        # Swap bottoms
        for col in ["Bottom_Article", "Bottom_Price", "Bottom_Color", "Bottom_Pattern", "Bottom_Stock_Status", "Bottom_Type", "Bottom_Occasion"]:
            child1[col], child2[col] = child2.get(col), child1.get(col)
    return child1, child2


def _mutate(individual: dict, candidate_pool: list) -> dict:
    """Replace top or bottom with a random candidate from the pool."""
    donor = random.choice(candidate_pool)
    mutant = individual.copy()
    if random.random() < 0.5:
        for col in ["Top_Article", "Top_Price", "Top_Color", "Top_Pattern", "Top_Stock_Status", "Top_Type", "Top_Occasion"]:
            mutant[col] = donor.get(col)
    else:
        for col in ["Bottom_Article", "Bottom_Price", "Bottom_Color", "Bottom_Pattern", "Bottom_Stock_Status", "Bottom_Type", "Bottom_Occasion"]:
            mutant[col] = donor.get(col)
    return mutant


def run_ga(candidate_df: pd.DataFrame, num_outfits: int, max_price: float = 9999, preferred_colors: list = None) -> list:
    """
    Run the genetic algorithm on the candidate DataFrame.
    Returns a list of dicts representing the top N diverse outfits.
    """
    if candidate_df.empty:
        return []

    pref_set = set(preferred_colors) if preferred_colors else None
    candidate_pool = candidate_df.to_dict("records")
    print(f"GA: {len(candidate_pool)} candidate pairs, requesting {num_outfits} outfits, max_price={max_price}, preferred_colors={preferred_colors}")

    # Use larger population to maintain diversity for multi-outfit requests
    pop_size = max(POPULATION_SIZE, num_outfits * 30)
    pop_size = min(pop_size, len(candidate_pool))
    if pop_size == 0:
        return []

    population = random.choices(candidate_pool, k=pop_size)

    # Evolution loop
    for gen in range(GENERATIONS):
        fitnesses = [fitness(ind, max_price, pref_set) for ind in population]

        new_population = []

        # Elitism: keep the best individual
        best_idx = max(range(len(population)), key=lambda i: fitnesses[i])
        new_population.append(population[best_idx].copy())

        while len(new_population) < pop_size:
            parent1 = _tournament_select(population, fitnesses)
            parent2 = _tournament_select(population, fitnesses)

            if random.random() < CROSSOVER_RATE:
                child1, child2 = _crossover(parent1, parent2)
            else:
                child1, child2 = parent1, parent2

            if random.random() < MUTATION_RATE:
                child1 = _mutate(child1, candidate_pool)
            if random.random() < MUTATION_RATE:
                child2 = _mutate(child2, candidate_pool)

            new_population.append(child1)
            if len(new_population) < pop_size:
                new_population.append(child2)

        population = new_population

    # Final fitness evaluation — also score ALL original candidates for diverse selection
    # This ensures we have enough variety even if the GA population converges
    all_candidates = candidate_pool + population
    all_scored = {}
    for ind in all_candidates:
        key = (ind.get("Top_Article"), ind.get("Bottom_Article"))
        if key not in all_scored:
            score = fitness(ind, max_price, pref_set)
            all_scored[key] = (ind, score)

    # Weighted random diverse selection using softmax probabilities
    candidates_list = list(all_scored.values())
    scores = np.array([s for _, s in candidates_list])

    # Softmax with temperature: higher temp = more random, lower = more deterministic
    exp_scores = np.exp(scores / max(SELECTION_TEMP, 1e-8))
    probabilities = exp_scores / exp_scores.sum()

    selected = []
    used_tops = set()
    used_bottoms = set()
    remaining_indices = list(range(len(candidates_list)))

    while len(selected) < num_outfits and remaining_indices:
        # Sample from remaining candidates weighted by fitness
        remaining_probs = probabilities[remaining_indices]
        prob_sum = remaining_probs.sum()
        if prob_sum == 0:
            break
        remaining_probs = remaining_probs / prob_sum

        idx = np.random.choice(remaining_indices, p=remaining_probs)
        remaining_indices.remove(idx)

        ind, score = candidates_list[idx]
        top_id = ind.get("Top_Article")
        bottom_id = ind.get("Bottom_Article")

        if top_id in used_tops or bottom_id in used_bottoms:
            continue

        result = ind.copy()
        result["fitness_score"] = round(score, 4)
        selected.append(result)
        used_tops.add(top_id)
        used_bottoms.add(bottom_id)

    print(f"GA: returning {len(selected)} diverse outfits (scored {len(all_scored)} unique pairs)")
    return selected
