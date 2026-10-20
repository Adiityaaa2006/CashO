from typing import List, Dict, Any
from app.schemas import RuleTraceItem

class Fact:
    def __init__(self, name: str, value: Any):
        self.name = name
        self.value = value

class Rule:
    def __init__(self, name: str, condition_fn, action_fn, description: str):
        self.name = name
        self.condition_fn = condition_fn
        self.action_fn = action_fn
        self.description = description

class ForwardChainingEngine:
    """Forward-chaining inference engine maintaining working memory and fired rule history."""
    
    def __init__(self):
        self.facts: Dict[str, Any] = {}
        self.fired_rules: List[RuleTraceItem] = []

    def set_fact(self, key: str, value: Any):
        self.facts[key] = value

    def run(self, rules: List[Rule]) -> List[RuleTraceItem]:
        self.fired_rules = []
        agenda = list(rules)
        iteration = 0
        max_iterations = 20

        while agenda and iteration < max_iterations:
            iteration += 1
            fired_any = False
            for rule in list(agenda):
                if rule.condition_fn(self.facts):
                    trace = rule.action_fn(self.facts)
                    if trace:
                        self.fired_rules.append(trace)
                    agenda.remove(rule)
                    fired_any = True
            if not fired_any:
                break

        return self.fired_rules
