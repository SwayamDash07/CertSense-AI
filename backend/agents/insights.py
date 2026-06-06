"""
Agent 5: Insights Agent
Tracks improvement over time and generates progress reports.
"""

import asyncio
from typing import Dict, Any, List
from datetime import datetime
from services.llm import LLM


class InsightsAgent:
    """
    Insights Agent
    
    Responsibilities:
    - Compare current session with past sessions
    - Identify improvement trends and regressions
    - Generate detailed progress reports
    - Celebrate milestones and flag stagnation
    
    Uses Foundry IQ to log and retrieve historical performance data.
    """

    def __init__(self):
        self.llm = LLM()

    async def generate(self, coach_output: dict, session_history: list) -> dict:
        """Generate insights by comparing current session with history."""
        current_score = coach_output.get("overall_score", 7.0)
        current_metrics = coach_output.get("metrics", {})
        
        if not session_history:
            # First session — set baseline
            return {
                "is_first_session": True,
                "baseline_score": current_score,
                "trend": "baseline",
                "trend_direction": "neutral",
                "trend_percentage": 0,
                "report": self._baseline_report(current_score, current_metrics),
                "milestones": [],
                "session_count": 1,
                "chart_data": [{"session": 1, "score": current_score, "date": datetime.now().isoformat()}]
            }
        
        # Multi-session analysis
        scores = [s.get("overall_score", 7.0) for s in session_history]
        scores.append(current_score)
        
        improvement = current_score - scores[0] if len(scores) > 1 else 0
        recent_trend = self._calculate_trend(scores)
        milestones = self._check_milestones(scores, current_metrics, session_history, coach_output)
        
        # Per-metric comparison
        metric_trends = self._compare_metrics(current_metrics, session_history)
        
        return {
            "is_first_session": False,
            "current_score": current_score,
            "starting_score": scores[0],
            "total_improvement": round(improvement, 1),
            "trend": recent_trend["label"],
            "trend_direction": recent_trend["direction"],
            "trend_percentage": recent_trend["percentage"],
            "report": self._generate_report(scores, improvement, metric_trends),
            "milestones": milestones,
            "metric_trends": metric_trends,
            "session_count": len(scores),
            "chart_data": [
                {"session": i + 1, "score": s, "date": session_history[i].get("date", "") if i < len(session_history) else datetime.now().isoformat()}
                for i, s in enumerate(scores)
            ]
        }

    def _calculate_trend(self, scores: list) -> dict:
        """Determine the recent performance trend."""
        if len(scores) < 2:
            return {"label": "Starting", "direction": "neutral", "percentage": 0}
        
        recent = scores[-3:] if len(scores) >= 3 else scores
        if recent[-1] > recent[0]:
            change = ((recent[-1] - recent[0]) / recent[0]) * 100
            return {"label": "Improving", "direction": "up", "percentage": round(change, 1)}
        elif recent[-1] < recent[0] - 0.5:
            change = ((recent[0] - recent[-1]) / recent[0]) * 100
            return {"label": "Declining", "direction": "down", "percentage": round(change, 1)}
        else:
            return {"label": "Steady", "direction": "neutral", "percentage": 0}

    def _check_milestones(self, scores: list, current_metrics: dict, history: list, current: dict) -> list:
        """Check for achievement milestones."""
        milestones = []
        current_score = scores[-1]
        
        # Score milestones
        if current_score >= 7.5 and max(scores[:-1], default=0) < 7.5:
            milestones.append({
                "type": "score_milestone",
                "title": "🎯 Passed Readiness Threshold!",
                "message": "You've crossed the 7.5 passing threshold — exam-ready territory!",
                "achieved_at": "this session"
            })
        
        if current_score >= 9.0 and max(scores[:-1], default=0) < 9.0:
            milestones.append({
                "type": "excellence",
                "title": "⭐ Certification Mastery",
                "message": "9.0+ readiness score — you're in elite exam prep territory!",
                "achieved_at": "this session"
            })
        
        # Practice score improvement
        if len(history) > 0:
            prev_practice = history[-1].get("metrics", {}).get("practice_score", 5)
            curr_practice = current_metrics.get("practice_score", 5)
            if prev_practice > 0 and curr_practice > prev_practice * 1.2:
                milestones.append({
                    "type": "practice_improvement",
                    "title": "📈 Practice Score Up!",
                    "message": f"Practice score improved by {round((curr_practice/prev_practice - 1) * 100)}% — keep it up!",
                    "achieved_at": "this session"
                })
        
        # Consistency milestone
        if len(scores) >= 5 and min(scores[-5:]) >= 7.5:
            milestones.append({
                "type": "consistency",
                "title": "🔥 5-Session Streak",
                "message": "5 consecutive sessions above passing threshold — consistency is the key to certification!",
                "achieved_at": "this session"
            })
        
        return milestones

    def _compare_metrics(self, current: dict, history: list) -> dict:
        """Compare each metric against session history."""
        if not history:
            return {}
        
        prev_metrics = history[-1].get("metrics", {})
        
        trends = {}
        metric_keys = ["readiness_score", "practice_score", "vocabulary_score", "pace_score"]
        
        for key in metric_keys:
            curr_val = current.get(key, 0)
            prev_val = prev_metrics.get(key, 0)
            
            if prev_val > 0:
                change = curr_val - prev_val
                # For all cert metrics, higher is better
                direction = "improved" if change > 0 else ("declined" if change < -0.5 else "stable")
                
                trends[key] = {
                    "current": round(curr_val, 1),
                    "previous": round(prev_val, 1),
                    "change": round(change, 1),
                    "direction": direction,
                    "magnitude": round(magnitude, 1)
                }
        
        return trends

    def _baseline_report(self, score: float, metrics: dict) -> str:
        readiness = metrics.get("readiness_score", score)
        practice = metrics.get("practice_score", 0)
        
        return (
            f"Baseline established at {score}/10. "
            f"Readiness: {readiness:.1f}/10. "
            f"Practice score: {practice:.1f}/10. "
            "Complete your first study plan session to see your improvement trajectory."
        )

    def _generate_report(self, scores: list, improvement: float, metric_trends: dict) -> str:
        sessions = len(scores)
        latest = scores[-1]
        
        if improvement > 0:
            trend_text = f"improved by {improvement:.1f} points across {sessions} sessions"
        else:
            trend_text = f"maintained consistent performance across {sessions} sessions"
        
        top_improvement = ""
        for key, data in metric_trends.items():
            if data.get("direction") == "improved":
                area = key.replace("_score", "").replace("_", " ")
                top_improvement = f"Notable improvement in {area}. "
                break
        
        return f"You have {trend_text}. Current score: {latest}/10. {top_improvement}Keep up the daily practice routine."