import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router";
import {
  Activity, LayoutDashboard, Droplets, Utensils, Settings,
  LogOut, Menu, X, Send, Square, Copy, Check,
  RotateCcw, Plus, Sparkles, ChevronRight, MessageSquare,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  timestamp: Date;
}

interface Conversation {
  id: number;
  title: string;
  preview: string;
  date: string;
  messages: Message[];
}

// ─── AI Response Library ──────────────────────────────────────────────────────
const getAIResponse = (input: string, history: Message[]): string => {
  const q = input.toLowerCase();
  const hasContext = history.length > 2;

  if (/\b(hello|hi|hey|good morning|good afternoon|good evening|start|begin)\b/.test(q)) {
    return `Hello! I'm **DiaCheck AI**, your personal health assistant specialized in diabetes care and management.\n\nI have access to your health profile and can provide personalized insights based on your glucose readings, meal logs, and medical history. Here's what I can help you with:\n\n- **Glucose Analysis** — interpreting your readings and trends\n- **Nutrition Guidance** — meal planning and carb management\n- **Medication Support** — understanding your prescriptions\n- **Lifestyle Coaching** — exercise, sleep, and stress management\n- **Symptom Assessment** — recognizing warning signs\n- **Treatment Context** — explaining your doctor's recommendations\n\nWhat would you like to explore today?`;
  }

  if (/\b(fasting glucose|fasting blood sugar|morning glucose|112|fasting reading)\b/.test(q)) {
    return `Your fasting glucose of **112 mg/dL** places you in the **prediabetes range** (100–125 mg/dL), which warrants attention but is very manageable with the right approach.\n\n## What This Means\n\nA fasting glucose of 112 mg/dL suggests your body is having some difficulty processing glucose overnight, likely due to a combination of insulin resistance and reduced insulin secretion. This is a common early sign of Type 2 diabetes progression.\n\n## Key Factors That May Be Contributing\n\n- **Dietary choices** — high-carbohydrate meals, especially in the evening\n- **Physical inactivity** — reduces insulin sensitivity overnight\n- **Sleep quality** — poor sleep significantly impairs glucose regulation\n- **Stress levels** — cortisol raises blood sugar\n- **Medication timing** — if you're on Metformin, evening dosing may help\n\n## Actionable Steps\n\n1. **Avoid carb-heavy meals after 7 PM** — stick to protein and vegetables at dinner\n2. **Take a 15–20 minute walk after dinner** — this can reduce fasting glucose by 10–15 mg/dL\n3. **Ensure 7–8 hours of quality sleep** — sleep deprivation directly raises cortisol\n4. **Stay hydrated** — drink water before bed and upon waking\n5. **Log consistently** — your next fasting reading should be compared against this baseline\n\n> **Important:** Discuss this pattern with Dr. Sarah Chen at your next visit. If fasting levels consistently exceed 110 mg/dL, a medication adjustment may be considered.\n\nWould you like me to suggest a specific evening meal plan to help lower tomorrow's fasting reading?`;
  }

  if (/\b(post.?meal|after meal|postprandial|148|after eating|2 hours)\b/.test(q)) {
    return `A post-meal glucose of **148 mg/dL** is at the upper end of the acceptable range. The American Diabetes Association recommends staying below **180 mg/dL** two hours after eating, though many clinicians prefer a target under **140 mg/dL** for tighter control.\n\n## Interpreting Your Reading\n\n| Timing | Your Reading | Target | Status |\n|--------|-------------|--------|--------|\n| 2h post-meal | 148 mg/dL | <140 mg/dL | ⚠️ Slightly elevated |\n\n## What Caused the Spike?\n\nYour breakfast log shows **oatmeal + fruit (~65g carbs)**. While oatmeal is generally a healthy choice, the combination with fruit added considerable sugar load. Here's the breakdown:\n\n- **Oatmeal (1 cup cooked):** ~27g carbs\n- **Banana (medium):** ~27g carbs\n- **Mixed berries (½ cup):** ~11g carbs\n- **Total:** ~65g carbs in one meal\n\nFor someone managing diabetes, **45g carbs per meal** is a common target.\n\n## How to Reduce Post-Meal Spikes\n\n1. **Portion control** — reduce carb load to 40–45g per meal\n2. **Add protein and fat** — Greek yogurt or nuts slow glucose absorption\n3. **Choose lower-GI fruits** — berries are great; reduce banana portions\n4. **Walk for 10–15 minutes** after breakfast — highly effective\n5. **Consider steel-cut oats** over rolled oats — lower glycemic index\n\nWould you like a modified breakfast plan that targets a post-meal glucose below 130 mg/dL?`;
  }

  if (/\b(meal plan|diet plan|what (should i|can i) eat|food|nutrition|diabetes diet)\b/.test(q)) {
    return `Based on your health profile — **Type 2 Diabetes, Metformin 1000mg, average glucose 112 mg/dL** — here's a personalized meal plan designed to stabilize your blood sugar throughout the day.\n\n## 7-Day Diabetes-Friendly Meal Framework\n\n### 🌅 Breakfast (Target: 40–45g carbs)\n- **Option A:** 2 eggs scrambled + ½ cup steel-cut oats + ½ cup blueberries\n- **Option B:** Greek yogurt (plain) + 2 tbsp chia seeds + ¼ cup walnuts + ½ apple\n- **Option C:** Veggie omelette (spinach, mushroom, bell pepper) + 1 slice whole-grain toast\n\n### ☀️ Lunch (Target: 45–50g carbs)\n- **Option A:** Grilled chicken breast + 1 cup quinoa + large mixed-green salad with olive oil\n- **Option B:** Tuna wrap (whole wheat tortilla) + cucumber sticks + 1 small orange\n- **Option C:** Lentil soup + 1 slice sourdough bread + side salad\n\n### 🌙 Dinner (Target: 40–45g carbs)\n- **Option A:** Baked salmon + roasted Brussels sprouts + ½ cup brown rice\n- **Option B:** Turkey meatballs + zucchini noodles + marinara sauce (low-sugar)\n- **Option C:** Grilled tofu + stir-fried bok choy + ½ cup farro\n\n### 🍎 Snacks (Target: 15–20g carbs each)\n- Small apple + 1 tbsp almond butter\n- 15 almonds + 1 string cheese\n- Hummus (3 tbsp) + vegetable sticks\n\n## Foods to Limit\n- White bread, white rice, regular pasta\n- Sugary beverages (juice, soda, sweetened coffee)\n- Processed snacks, cookies, crackers\n- High-sugar fruits in large portions (mango, grapes, bananas)\n\n## Key Principles\n- **Eat at consistent times** — irregular meals disrupt insulin patterns\n- **Never skip breakfast** — increases cortisol and fasting glucose\n- **Hydrate** — aim for 8–10 glasses of water daily\n- **Read labels** — aim for <5g sugar and >3g fiber per serving\n\nWould you like me to calculate the expected glycemic impact of any specific meal, or create a shopping list?`;
  }

  if (/\b(metformin|medication|medicine|drug|pill|dose|prescription|side effect)\b/.test(q)) {
    return `You're currently prescribed **Metformin 1000mg**, which is the most commonly used and well-studied first-line medication for Type 2 Diabetes. Let me give you a comprehensive breakdown.\n\n## How Metformin Works\n\nMetformin works through **three primary mechanisms:**\n\n1. **Reduces hepatic glucose production** — your liver produces glucose overnight (gluconeogenesis). Metformin suppresses this by ~30%, which is why it's particularly effective for lowering fasting glucose.\n\n2. **Improves insulin sensitivity** — it makes your cells more responsive to insulin, reducing the amount needed to process glucose.\n\n3. **Slows intestinal glucose absorption** — reduces how quickly glucose from food enters your bloodstream.\n\n## What to Expect\n\n| Timeline | Effect |\n|----------|--------|\n| Week 1–2 | Possible GI side effects (nausea, loose stools) |\n| Week 2–4 | GI effects usually resolve |\n| Week 4–8 | Noticeable reduction in fasting glucose |\n| Month 3 | Full HbA1c benefit visible |\n\n## Managing Side Effects\n\nIf you experience **nausea or stomach upset:**\n- Always take Metformin **with food** — never on an empty stomach\n- Start with dinner dose if you take it twice daily\n- Ask Dr. Chen about **extended-release (Metformin ER)** — same efficacy with fewer GI issues\n- Avoid alcohol while on Metformin\n\n## Important Warnings\n\n- **Never skip doses** without consulting your doctor\n- **Inform your doctor before any imaging scans** — contrast dye may interact\n- **Monitor kidney function** — Metformin requires adequate kidney clearance\n- **Vitamin B12** — long-term use may reduce B12 absorption; consider supplementation\n\n> Your current dose of 1000mg is a standard therapeutic dose. Dr. Chen may adjust this based on your next HbA1c result.\n\nDo you have any specific side effects you'd like me to address?`;
  }

  if (/\b(exercise|workout|physical activity|walking|gym|sport|run|cycling)\b/.test(q)) {
    return `Exercise is arguably the most powerful non-pharmaceutical tool for managing diabetes. Here's a science-backed approach tailored to your health profile.\n\n## How Exercise Affects Your Blood Sugar\n\n**During exercise:** Muscles use glucose directly without requiring insulin — this creates an immediate glucose-lowering effect.\n\n**After exercise:** Improved insulin sensitivity can last **24–72 hours**, meaning your body processes glucose more efficiently for days after a workout.\n\n## Exercise Recommendations for Type 2 Diabetes\n\n### 🏃 Aerobic Exercise (Most Important)\n- **Goal:** 150+ minutes per week of moderate intensity\n- **Best options:** brisk walking, cycling, swimming, dancing\n- **Timing:** 30–45 minutes, 5 days/week, or 20 min after each meal\n- **Glucose impact:** Can lower blood sugar by **20–40 mg/dL** per session\n\n### 💪 Resistance Training\n- **Goal:** 2–3 sessions per week\n- **Best options:** weight training, resistance bands, bodyweight exercises\n- **Why it matters:** Muscle tissue is your largest glucose reservoir — more muscle = better glucose control\n\n### 🚶 Post-Meal Walking (Highest ROI)\nBased on your readings (fasting 112, post-meal 148), **a 15-minute walk after each meal** could be your single most impactful habit. Studies show this reduces post-meal glucose spikes by **22%** on average.\n\n## Safety Guidelines\n\n- **Check glucose before exercise** if below 100 mg/dL, eat a small snack first\n- **Carry fast-acting carbs** during exercise (glucose tablets or juice)\n- **Stay hydrated** — dehydration raises blood sugar\n- **Don't exercise if glucose >250 mg/dL** — wait until levels come down\n- **Wear proper footwear** — foot health is critical for diabetics\n\n## Starting Plan (If You're Currently Inactive)\n\n**Week 1–2:** 10-minute walk after dinner each day\n**Week 3–4:** 20-minute walk after dinner + 10 min after breakfast\n**Month 2:** Add 2x/week bodyweight resistance training\n**Month 3+:** Progress to 30–45 min aerobic sessions\n\nWould you like a more detailed weekly workout schedule?`;
  }

  if (/\b(hba1c|a1c|hemoglobin|glycated|3 month|quarterly)\b/.test(q)) {
    return `HbA1c (Glycated Hemoglobin) is one of the most important metrics for managing diabetes. Here's everything you need to know.\n\n## What HbA1c Measures\n\nHbA1c reflects your **average blood glucose over the past 2–3 months** by measuring the percentage of hemoglobin proteins in your red blood cells that have glucose attached. Unlike a daily glucose reading (a snapshot), HbA1c provides a comprehensive overview of your long-term glucose control.\n\n## Understanding Your Results\n\n| HbA1c Level | Category | Estimated Avg Glucose |\n|-------------|----------|----------------------|\n| Below 5.7% | Normal | ~117 mg/dL |\n| 5.7–6.4% | Prediabetes | 117–137 mg/dL |\n| 6.5–7.0% | Diabetes (well-controlled) | 137–154 mg/dL |\n| 7.0–8.0% | Diabetes (moderate) | 154–183 mg/dL |\n| Above 8.0% | Diabetes (poorly controlled) | >183 mg/dL |\n\n## Your Testing Schedule\n\nYour profile shows an **HbA1c lab test is due in 5 days**. It's important not to delay this — the results will:\n- Confirm whether your current treatment is working\n- Guide Dr. Chen in adjusting your Metformin dose\n- Establish a baseline for tracking progress\n\n## How to Improve Your HbA1c Before the Test\n\nNote: HbA1c reflects 90 days of history — you can't change it in 5 days. However, consistent habits now will improve your **next** result:\n\n1. **Consistent low-carb eating** has the largest impact\n2. **Daily exercise** — even walking\n3. **Medication adherence** — never skip Metformin\n4. **Stress reduction** — chronic stress raises HbA1c significantly\n5. **Quality sleep** — 7–8 hours directly impacts glucose regulation\n\n## What to Ask Your Doctor\n\n- "What HbA1c target should I be aiming for?"\n- "Should my Metformin dose be adjusted based on these results?"\n- "Are there additional tests I should have alongside HbA1c?"\n\nWould you like help preparing questions for your upcoming appointment?`;
  }

  if (/\b(insulin|type 1|type 2|difference|what is diabetes|explain diabetes)\b/.test(q)) {
    return `Great question. Understanding diabetes at a mechanistic level helps you make better decisions every day.\n\n## What Is Diabetes?\n\nDiabetes is a chronic metabolic condition characterized by **elevated blood glucose levels** resulting from problems with insulin production, insulin action, or both.\n\n**Insulin** is a hormone produced by beta cells in your pancreas. Its primary job is to act as a "key" that unlocks cells, allowing glucose from the bloodstream to enter and be used for energy.\n\n## Type 1 vs. Type 2\n\n### Type 1 Diabetes\n- **Cause:** Autoimmune destruction of beta cells — the body attacks its own insulin-producing cells\n- **Insulin:** Little to none produced; **requires insulin therapy**\n- **Onset:** Usually childhood/young adulthood (but can occur at any age)\n- **Management:** Insulin injections or pump, continuous glucose monitoring\n- **Prevalence:** ~5–10% of all diabetes cases\n\n### Type 2 Diabetes (Your Diagnosis)\n- **Cause:** Combination of **insulin resistance** (cells don't respond to insulin properly) + **progressive beta cell decline**\n- **Insulin:** Produced but used inefficiently\n- **Onset:** Usually adult onset, increasingly in younger people\n- **Management:** Lifestyle changes, oral medications (Metformin), potentially insulin later\n- **Prevalence:** ~90–95% of all diabetes cases\n\n## The Progression of Type 2\n\n1. **Insulin Resistance** — cells become resistant to insulin's signal\n2. **Compensatory hyperinsulinemia** — pancreas produces more insulin to overcome resistance\n3. **Beta cell exhaustion** — years of overproduction leads to declining insulin output\n4. **Prediabetes** — glucose starts rising above normal\n5. **Type 2 Diabetes** — consistent hyperglycemia meets diagnostic criteria\n\n> The good news: **Type 2 diabetes can go into remission** with significant lifestyle changes and weight loss. Some people are able to reduce or eliminate medication with sustained effort.\n\nWould you like to understand more about what specifically drives your glucose levels, or how to track your progress toward remission?`;
  }

  if (/\b(symptom|feel|feeling|tired|fatigue|thirst|urination|blurry|vision|headache|dizzy)\b/.test(q)) {
    return `Thank you for sharing how you're feeling. Symptom awareness is critical in diabetes management. Let me help you interpret what you're experiencing.\n\n## Common Symptoms and Their Glucose Correlation\n\n### 🔴 High Blood Sugar (Hyperglycemia)\nTypically occurs when glucose exceeds **180 mg/dL**\n\n- **Increased thirst (polydipsia)** — kidneys work overtime to filter excess glucose\n- **Frequent urination (polyuria)** — glucose pulls water into urine\n- **Fatigue and weakness** — cells can't use glucose efficiently\n- **Blurry vision** — high glucose causes fluid shifts in the eye lens\n- **Slow wound healing** — impaired blood flow and immune function\n- **Headaches** — dehydration from frequent urination\n- **Fruity-smelling breath** — potential sign of ketoacidosis (emergency)\n\n### 🔵 Low Blood Sugar (Hypoglycemia)\nTypically occurs when glucose drops below **70 mg/dL**\n\n- **Shakiness and trembling** — adrenaline response to falling glucose\n- **Sweating** — autonomic nervous system activation\n- **Confusion or difficulty concentrating** — brain depends on glucose\n- **Racing heartbeat** — fight-or-flight response\n- **Irritability or anxiety** — neurological glucose deprivation\n- **Pale skin** — blood redirected from extremities\n\n## When to Seek Immediate Care\n\n🚨 **Call emergency services if:**\n- Glucose above **300 mg/dL** with vomiting or confusion\n- Glucose below **50 mg/dL** and not responding to treatment\n- Fruity breath + nausea + rapid breathing (possible DKA)\n- Loss of consciousness or inability to swallow\n\n## What to Do Right Now\n\n1. **Check your glucose immediately** using your glucometer\n2. Log the reading along with your current symptoms\n3. If high: drink water, walk for 15 minutes, take medication if prescribed\n4. If low: consume 15g fast-acting carbs immediately (4 oz juice, glucose tablets)\n5. Recheck in 15 minutes\n\nWhat symptoms are you currently experiencing? I can provide more targeted guidance.`;
  }

  if (/\b(stress|anxiety|mental health|sleep|insomnia|rest|tired|burnout|overwhelm)\b/.test(q)) {
    return `The connection between mental health, sleep, and blood sugar is deeply significant — and often underestimated. Let me explain why this matters for your diabetes management.\n\n## The Stress-Glucose Connection\n\nWhen you're stressed, your body releases **cortisol and adrenaline** — the "fight-or-flight" hormones. These directly raise blood glucose by:\n\n1. Signaling the liver to release stored glucose (glycogen)\n2. Reducing insulin sensitivity in peripheral tissues\n3. Suppressing the immune system (worsens inflammation)\n4. Disrupting sleep, which compounds glucose dysregulation\n\nStudies show that **chronic psychological stress can raise HbA1c by 0.5–1.0%** independent of diet and exercise.\n\n## Sleep and Blood Sugar\n\nPoor sleep is particularly harmful:\n\n- **Less than 6 hours** of sleep increases insulin resistance equivalent to gaining 10–15 lbs\n- Sleep deprivation raises cortisol, which counteracts insulin\n- Growth hormone (released during deep sleep) can cause the **Dawn Phenomenon** — a natural morning glucose rise that's amplified by poor sleep\n- Sleep debt increases cravings for high-carb foods\n\n## Evidence-Based Stress Management\n\n### Immediate Techniques\n- **4-7-8 Breathing:** Inhale 4 sec, hold 7 sec, exhale 8 sec — activates parasympathetic nervous system\n- **5-minute body scan:** Mentally release tension in each body part\n- **Cold water on face** — triggers the dive reflex, slowing heart rate rapidly\n\n### Daily Habits\n- **Morning sunlight exposure** (10–20 min) — regulates cortisol rhythm\n- **Consistent sleep schedule** — same bedtime/wake time, even weekends\n- **Digital sunset** — no screens 1 hour before bed\n- **Journaling** — 5 minutes of gratitude reduces cortisol measurably\n- **Social connection** — isolation worsens both stress and glucose control\n\n### Exercise as Stress Medicine\nEven a 20-minute walk reduces cortisol by ~12% and improves mood for 2–3 hours.\n\nWould you like help creating a personalized sleep and stress management routine?`;
  }

  if (/\b(weight|bmi|lose weight|overweight|obesity|body weight|fat)\b/.test(q)) {
    return `Weight management is one of the most powerful levers for improving diabetes outcomes. Even modest weight loss has profound effects on glucose control.\n\n## Why Weight Matters in Diabetes\n\n**Adipose tissue (body fat),** especially **visceral fat** around the abdomen, is metabolically active. Excess visceral fat:\n- Releases inflammatory cytokines that worsen insulin resistance\n- Contributes to fatty liver, which increases glucose output\n- Disrupts hormone signaling including leptin and adiponectin\n\n## The Impact of Weight Loss\n\n| Weight Loss | Expected Benefit |\n|------------|------------------|\n| 5% of body weight | 0.5% HbA1c reduction, improved insulin sensitivity |\n| 10% of body weight | Significant reduction in medication needs |\n| 15%+ of body weight | Possible diabetes remission in some patients |\n\n## Science-Based Weight Loss for Diabetics\n\n### Nutrition Strategy\n- **Caloric deficit:** 500–750 kcal/day below maintenance (never crash diet)\n- **Protein priority:** 1.2–1.6g per kg body weight — preserves muscle, increases satiety\n- **Reduce refined carbs** — not all carbs equally; focus on removing ultra-processed foods\n- **Time-restricted eating** (12:8 or 16:8) — growing evidence for glucose and weight benefits\n- **Fiber intake** — 25–35g daily slows digestion and promotes satiety\n\n### Exercise Strategy\n- **Resistance training is essential** — prevents muscle loss during caloric deficit\n- **NEAT (Non-Exercise Activity Thermogenesis)** — walking, standing, fidgeting burns significant calories\n- **Aim for 8,000–10,000 steps/day** as a baseline goal\n\n### Behavioral Approaches\n- **Food journaling** significantly improves adherence\n- **Sleep optimization** reduces hunger hormones (ghrelin) by ~18%\n- **Meal prepping** removes decision fatigue\n\n> **Note:** If your BMI is above 35 and lifestyle changes are insufficient, your doctor may discuss additional options including GLP-1 medications (like Semaglutide), which have shown remarkable results for both weight and blood glucose control.\n\nWould you like a specific calorie and macronutrient target based on your current stats?`;
  }

  if (/\b(complication|nerve|neuropathy|nephropathy|retinopathy|kidney|eye|foot|cardiovascular|heart)\b/.test(q)) {
    return `Understanding and preventing diabetic complications is essential for long-term health. Here's a comprehensive overview.\n\n## Long-Term Complications of Diabetes\n\nChronic hyperglycemia damages blood vessels and nerves throughout the body. Complications are categorized as **microvascular** (small vessels) and **macrovascular** (large vessels).\n\n## Microvascular Complications\n\n### 👁️ Diabetic Retinopathy\n- **What:** Damage to blood vessels in the retina; leading cause of blindness in adults\n- **Symptoms:** Blurry vision, floaters, dark areas in vision\n- **Prevention:** HbA1c <7%, blood pressure control, annual dilated eye exam\n- **Timeline:** Can develop after 5–10 years of poorly controlled diabetes\n\n### 🫘 Diabetic Nephropathy (Kidney Disease)\n- **What:** Damage to kidney filtering units (glomeruli)\n- **Symptoms:** Initially asymptomatic; later swelling, fatigue, decreased urination\n- **Prevention:** HbA1c control, blood pressure <130/80, annual urine albumin test\n- **Note:** Early kidney disease is **reversible** with tight control\n\n### ⚡ Diabetic Neuropathy (Nerve Damage)\n- **What:** Damage to peripheral nerves, usually starting in feet\n- **Symptoms:** Numbness, tingling, burning pain in hands/feet, muscle weakness\n- **Prevention:** Tight glucose control, B12 supplementation if on Metformin\n- **Foot care:** Daily foot inspection is critical — minor wounds can become serious\n\n## Macrovascular Complications\n\n### ❤️ Cardiovascular Disease\n- Diabetics have **2–4× higher risk** of heart attack and stroke\n- Risk factors compound: diabetes + hypertension + high cholesterol = very high risk\n- **Prevention:** Statin therapy (often prescribed), aspirin (if indicated), smoking cessation\n\n### 🦶 Peripheral Artery Disease\n- Reduced blood flow to limbs — causes poor wound healing\n- Regular foot exams detect early signs\n\n## Your Prevention Checklist\n\n- ✅ HbA1c every 3–6 months\n- ✅ Annual dilated eye exam\n- ✅ Annual urine albumin + kidney function test\n- ✅ Annual comprehensive foot exam\n- ✅ Blood pressure monitored at every visit\n- ✅ Lipid panel annually\n- ✅ Daily foot self-inspection\n\nThe great news: **complications are largely preventable** with consistent glucose control. Every 1% reduction in HbA1c reduces complication risk by 25–40%.\n\nWould you like guidance on any specific complication or prevention strategy?`;
  }

  if (/\b(thank|thanks|perfect|great answer|helpful|exactly|good|appreciate)\b/.test(q)) {
    return `You're very welcome! 😊\n\nRemember — managing diabetes is a marathon, not a sprint. Every healthy choice you make today compounds over time into significantly better outcomes. Your consistency with logging glucose and meals is already a great foundation.\n\n**A few things to keep in mind:**\n- Small, sustainable changes outperform dramatic short-term efforts\n- Your next HbA1c will reflect everything you've done in the past 3 months\n- Dr. Sarah Chen is your partner in this — don't hesitate to bring these AI-generated insights to your appointments\n\nIs there anything else I can help you with today?`;
  }

  // Context-aware follow-up
  if (hasContext && /\b(more|tell me more|explain|expand|elaborate|what about|how about)\b/.test(q)) {
    return `Happy to go deeper on this. Based on our conversation, it seems you're focused on optimizing your glucose control through evidence-based approaches.\n\nA few directions we could explore:\n\n1. **Personalized glucose targets** — what numbers should you specifically be aiming for given your diagnosis and age\n2. **Advanced carb counting** — how to calculate glycemic load, not just glycemic index\n3. **Continuous glucose monitoring** — whether a CGM device might benefit your situation\n4. **Medication optimization** — signs that your current regimen may need review\n5. **Lab test interpretation** — understanding all the values in your metabolic panel\n\nWhich of these would be most useful to explore?`;
  }

  return `That's a thoughtful question. Based on your health profile and the context of managing **Type 2 Diabetes** with Metformin, here's my analysis:\n\nWhile I want to provide you with the most accurate and relevant information, this particular topic may benefit from a nuanced discussion with **Dr. Sarah Chen**, who has your complete medical history and can provide personalized clinical guidance.\n\nWhat I can offer:\n- **Evidence-based general guidance** on diabetes management\n- **Interpretation of your logged readings** and trends\n- **Lifestyle and nutrition recommendations** aligned with current clinical guidelines\n- **Preparation for your doctor's appointments** — helping you ask the right questions\n\nCould you rephrase or provide more context about what you're looking for? For example:\n- Are you asking about a specific glucose reading?\n- Is this related to a symptom you're experiencing?\n- Are you looking for dietary or exercise guidance?\n\nI'm here to provide the most helpful response possible.`;
};

// ─── Mock Past Conversations ──────────────────────────────────────────────────
const pastConversations: Conversation[] = [
  {
    id: 101,
    title: "Understanding my HbA1c result",
    preview: "My HbA1c came back at 7.2%, what does this mean...",
    date: "Apr 28",
    messages: [],
  },
  {
    id: 102,
    title: "Meal plan for the week",
    preview: "Can you create a 7-day diabetes-friendly meal plan...",
    date: "Apr 25",
    messages: [],
  },
  {
    id: 103,
    title: "Exercise and blood sugar",
    preview: "How does working out affect my glucose levels...",
    date: "Apr 22",
    messages: [],
  },
  {
    id: 104,
    title: "Metformin side effects",
    preview: "I've been experiencing nausea after taking Metformin...",
    date: "Apr 19",
    messages: [],
  },
];

// ─── Suggested prompts ────────────────────────────────────────────────────────
const SUGGESTED_PROMPTS = [
  {
    icon: "💉",
    title: "Explain my fasting glucose",
    subtitle: "112 mg/dL this morning",
    prompt: "My fasting glucose reading was 112 mg/dL this morning. What does this mean and what should I do?",
  },
  {
    icon: "🍽️",
    title: "Create a meal plan",
    subtitle: "Tailored to my condition",
    prompt: "Can you create a personalized meal plan for managing my Type 2 diabetes?",
  },
  {
    icon: "💊",
    title: "About my Metformin",
    subtitle: "1000mg twice daily",
    prompt: "Can you explain how Metformin works and what side effects I should watch for?",
  },
  {
    icon: "🏃",
    title: "Exercise guidance",
    subtitle: "Safe workouts for diabetics",
    prompt: "What type of exercise is best for managing Type 2 diabetes and how does it affect blood sugar?",
  },
  {
    icon: "📊",
    title: "My HbA1c explained",
    subtitle: "Lab test due in 5 days",
    prompt: "Can you explain what HbA1c measures and what I should aim for?",
  },
  {
    icon: "⚠️",
    title: "Complication prevention",
    subtitle: "Long-term diabetes care",
    prompt: "What are the main diabetes complications I should watch for and how can I prevent them?",
  },
];

// ─── Markdown Renderer ────────────────────────────────────────────────────────
function renderMarkdown(text: string): JSX.Element {
  const lines = text.split("\n");
  const elements: JSX.Element[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // H2
    if (line.startsWith("## ")) {
      elements.push(
        <h3 key={key++} className="text-slate-900 mt-5 mb-2 first:mt-0" style={{ fontWeight: 700, fontSize: "1rem" }}>
          {line.slice(3)}
        </h3>
      );
      i++;
      continue;
    }

    // H3
    if (line.startsWith("### ")) {
      elements.push(
        <h4 key={key++} className="text-slate-800 mt-4 mb-1.5" style={{ fontWeight: 600, fontSize: "0.9rem" }}>
          {line.slice(4)}
        </h4>
      );
      i++;
      continue;
    }

    // Table
    if (line.startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        if (!lines[i].match(/^\|[-| ]+\|$/)) tableLines.push(lines[i]);
        i++;
      }
      const rows = tableLines.map(l =>
        l.split("|").filter((_, idx, arr) => idx > 0 && idx < arr.length - 1).map(c => c.trim())
      );
      elements.push(
        <div key={key++} className="overflow-x-auto my-3">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                {rows[0]?.map((cell, ci) => (
                  <th key={ci} className="text-left px-3 py-2 bg-slate-100 border border-slate-200 text-slate-700" style={{ fontWeight: 600 }}>
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(1).map((row, ri) => (
                <tr key={ri} className={ri % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 border border-slate-200 text-slate-700">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Bullet list
    if (line.startsWith("- ") || line.startsWith("* ")) {
      const items: string[] = [];
      while (i < lines.length && (lines[i].startsWith("- ") || lines[i].startsWith("* "))) {
        items.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <ul key={key++} className="space-y-1 my-2 pl-1">
          {items.map((item, ii) => (
            <li key={ii} className="flex items-start gap-2 text-slate-700 text-sm leading-relaxed">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2 flex-shrink-0" />
              <span>{inlineMarkdown(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered list
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ""));
        i++;
      }
      elements.push(
        <ol key={key++} className="space-y-1.5 my-2 pl-1">
          {items.map((item, ii) => (
            <li key={ii} className="flex items-start gap-3 text-slate-700 text-sm leading-relaxed">
              <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center flex-shrink-0 mt-0.5" style={{ fontWeight: 700 }}>
                {ii + 1}
              </span>
              <span>{inlineMarkdown(item)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      elements.push(
        <blockquote key={key++} className="border-l-2 border-blue-400 pl-3 py-1 my-3 bg-blue-50/60 rounded-r-lg">
          <p className="text-blue-800 text-sm leading-relaxed italic">{inlineMarkdown(line.slice(2))}</p>
        </blockquote>
      );
      i++;
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Normal paragraph
    elements.push(
      <p key={key++} className="text-slate-700 text-sm leading-relaxed">
        {inlineMarkdown(line)}
      </p>
    );
    i++;
  }

  return <div className="space-y-1">{elements}</div>;
}

function inlineMarkdown(text: string): (string | JSX.Element)[] {
  const parts: (string | JSX.Element)[] = [];
  const regex = /\*\*(.+?)\*\*|_(.+?)_/g;
  let last = 0;
  let match;
  let idx = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    if (match[1]) parts.push(<strong key={idx++} style={{ fontWeight: 700 }} className="text-slate-900">{match[1]}</strong>);
    else if (match[2]) parts.push(<em key={idx++} className="italic">{match[2]}</em>);
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

// ─── Message Bubble ───────────────────────────────────────────────────────────
function MessageBubble({ msg, onCopy }: { msg: Message; onCopy: (text: string) => void }) {
  const isUser = msg.role === "user";
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopy(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isUser) {
    return (
      <div className="flex justify-end mb-6">
        <div className="max-w-[75%]">
          <div className="bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed">
            {msg.content}
          </div>
          <p className="text-right text-xs text-slate-400 mt-1.5 pr-1">
            {msg.timestamp.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 mb-6 group">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
        <Sparkles className="w-4 h-4 text-white" strokeWidth={2} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-slate-900 text-xs" style={{ fontWeight: 700 }}>DiaCheck AI</span>
          <span className="text-slate-300 text-xs">·</span>
          <span className="text-slate-400 text-xs">
            {msg.timestamp.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </span>
          {msg.streaming && (
            <span className="flex items-center gap-1 text-blue-500 text-xs">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
              generating…
            </span>
          )}
        </div>

        <div className="bg-white rounded-2xl rounded-tl-sm border border-slate-100 shadow-sm px-5 py-4">
          {msg.streaming
            ? <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">{msg.content}<span className="inline-block w-0.5 h-4 bg-blue-500 ml-0.5 animate-pulse align-text-bottom" /></p>
            : renderMarkdown(msg.content)
          }
        </div>

        {/* Actions */}
        {!msg.streaming && (
          <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Thinking Indicator ───────────────────────────────────────────────────────
function ThinkingIndicator() {
  return (
    <div className="flex items-start gap-3 mb-6">
      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-sm">
        <Sparkles className="w-4 h-4 text-white" strokeWidth={2} />
      </div>
      <div className="bg-white rounded-2xl rounded-tl-sm border border-slate-100 shadow-sm px-5 py-4 mt-0.5">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
          <span className="text-slate-400 text-xs">DiaCheck AI is analyzing your question…</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AIAssistantPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [abortStream, setAbortStream] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const streamRef = useRef(false);

  const handleSignOut = () => { signOut(); navigate("/"); };

  const sidebarNav = [
    { icon: LayoutDashboard, label: "Dashboard",    path: "/dashboard/patient",           active: false },
    { icon: Droplets,        label: "Glucose Logs", path: "/dashboard/patient/glucose",   active: false },
    { icon: Utensils,        label: "Meal Logs",    path: "/dashboard/patient/meals",     active: false },
    { icon: Sparkles,        label: "AI Assistant", path: "/dashboard/patient/ai-chat",   active: true  },
    { icon: Settings,        label: "Settings",     path: "/dashboard/patient/settings",  active: false },
  ];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 160) + "px";
    }
  }, [input]);

  const streamResponse = useCallback((fullText: string, msgId: number) => {
    streamRef.current = false;
    const words = fullText.split(" ");
    let idx = 0;

    const tick = () => {
      if (streamRef.current) {
        // aborted — set full text immediately
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: fullText, streaming: false } : m));
        setStreaming(false);
        return;
      }
      idx += 2; // reveal 2 words at a time for speed
      if (idx > words.length) idx = words.length;
      setMessages(prev =>
        prev.map(m => m.id === msgId
          ? { ...m, content: words.slice(0, idx).join(" "), streaming: idx < words.length }
          : m
        )
      );
      if (idx < words.length) {
        setTimeout(tick, 18);
      } else {
        setStreaming(false);
      }
    };
    setTimeout(tick, 18);
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || thinking || streaming) return;
    const userMsg: Message = { id: Date.now(), role: "user", content: text.trim(), timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setThinking(true);

    // Simulate thinking delay
    await new Promise(r => setTimeout(r, 900 + Math.random() * 600));
    setThinking(false);

    const responseText = getAIResponse(text, messages);
    const assistantMsg: Message = {
      id: Date.now() + 1,
      role: "assistant",
      content: "",
      streaming: true,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, assistantMsg]);
    setStreaming(true);
    streamRef.current = false;
    streamResponse(responseText, assistantMsg.id);
  }, [thinking, streaming, messages, streamResponse]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleStop = () => {
    streamRef.current = true;
  };

  const handleNewChat = () => {
    streamRef.current = true;
    setMessages([]);
    setInput("");
    setThinking(false);
    setStreaming(false);
    setActiveConvId(null);
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-screen bg-[#F7F8FC] overflow-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── App Sidebar ──────────────────────────────────────────────────────── */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-60 bg-white border-r border-slate-100 flex flex-col transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="flex items-center justify-between px-5 h-16 border-b border-slate-100 flex-shrink-0">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-teal-500 rounded-lg flex items-center justify-center">
              <Activity className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-slate-800" style={{ fontWeight: 700, fontSize: "1rem" }}>
              Dia<span className="text-blue-600">Check</span>
            </span>
          </Link>
          <button className="lg:hidden text-slate-400" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm" style={{ fontWeight: 700 }}>
              {user?.name?.charAt(0) ?? "P"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-slate-900 text-sm truncate" style={{ fontWeight: 600 }}>{user?.name ?? "Patient"}</p>
              <p className="text-slate-400 text-xs">Patient</p>
            </div>
          </div>
        </div>

        <nav className="px-3 py-3 space-y-0.5">
          {sidebarNav.map(({ icon: Icon, label, path, active }) => (
            <button
              key={label}
              onClick={() => navigate(path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}
              style={{ fontWeight: active ? 600 : 400 }}
            >
              <Icon className={`w-4 h-4 ${active ? "text-blue-600" : "text-slate-400"}`} strokeWidth={1.8} />
              <span className="flex-1 text-left">{label}</span>
            </button>
          ))}
        </nav>

        {/* Past Conversations */}
        <div className="flex-1 overflow-y-auto px-3 py-2 border-t border-slate-50">
          <p className="text-slate-400 text-xs px-3 py-2" style={{ fontWeight: 600 }}>RECENT CHATS</p>
          <div className="space-y-0.5">
            {pastConversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => setActiveConvId(conv.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors group ${activeConvId === conv.id ? "bg-blue-50" : "hover:bg-slate-50"}`}
              >
                <div className="flex items-start gap-2">
                  <MessageSquare className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-700 text-xs truncate" style={{ fontWeight: 500 }}>{conv.title}</p>
                    <p className="text-slate-400 text-xs truncate">{conv.date}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="px-3 py-4 border-t border-slate-100">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-4 h-4" strokeWidth={1.8} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Chat Area ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top Bar */}
        <header className="h-14 bg-white border-b border-slate-100 flex items-center justify-between px-5 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-500" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <div>
                <span className="text-slate-900 text-sm" style={{ fontWeight: 700 }}>DiaCheck AI</span>
                <span className="ml-2 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full" style={{ fontWeight: 600 }}>Health Model</span>
              </div>
            </div>
          </div>
          <button
            onClick={handleNewChat}
            className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 px-3 py-1.5 rounded-xl transition-colors bg-white hover:bg-slate-50"
            style={{ fontWeight: 500 }}
          >
            <Plus className="w-4 h-4" />
            New chat
          </button>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {isEmpty ? (
            /* ── Empty State ── */
            <div className="h-full flex flex-col items-center justify-center px-6 py-12">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center mb-6 shadow-lg shadow-blue-200">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-slate-900 mb-2 text-center" style={{ fontWeight: 800, fontSize: "1.5rem" }}>
                What can I help you with?
              </h2>
              <p className="text-slate-500 text-sm text-center max-w-md mb-10 leading-relaxed">
                I'm your personalized AI health assistant. I have access to your health profile and can provide
                evidence-based guidance on diabetes management, nutrition, medications, and more.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full max-w-3xl">
                {SUGGESTED_PROMPTS.map((p) => (
                  <button
                    key={p.title}
                    onClick={() => sendMessage(p.prompt)}
                    className="group text-left bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-2xl p-4 transition-all hover:shadow-md hover:shadow-blue-100/50"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl leading-none mt-0.5">{p.icon}</span>
                      <div>
                        <p className="text-slate-900 text-sm group-hover:text-blue-700 transition-colors" style={{ fontWeight: 600 }}>{p.title}</p>
                        <p className="text-slate-400 text-xs mt-0.5">{p.subtitle}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-400 mt-2 ml-auto transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* ── Message Thread ── */
            <div className="max-w-3xl mx-auto px-5 py-8">
              {messages.map(msg => (
                <MessageBubble key={msg.id} msg={msg} onCopy={handleCopy} />
              ))}
              {thinking && <ThinkingIndicator />}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="bg-white border-t border-slate-100 px-4 py-4 flex-shrink-0">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-end gap-3 bg-white border border-slate-200 rounded-2xl px-4 py-3 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-50 transition-all shadow-sm">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your glucose levels, diet, medications, symptoms…"
                rows={1}
                disabled={thinking}
                className="flex-1 text-sm text-slate-900 placeholder-slate-400 bg-transparent focus:outline-none resize-none leading-relaxed"
                style={{ minHeight: "24px", maxHeight: "160px" }}
              />
              <div className="flex items-center gap-2 flex-shrink-0 pb-0.5">
                {streaming ? (
                  <button
                    onClick={handleStop}
                    className="w-9 h-9 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors"
                    title="Stop generating"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                  </button>
                ) : (
                  <button
                    onClick={() => sendMessage(input)}
                    disabled={!input.trim() || thinking}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                      input.trim() && !thinking
                        ? "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
                        : "bg-slate-100 text-slate-400 cursor-not-allowed"
                    }`}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            <p className="text-center text-xs text-slate-400 mt-2.5">
              DiaCheck AI provides health information, not medical advice. Always consult your doctor for clinical decisions. <span className="text-slate-300">·</span> Press <kbd className="px-1 py-0.5 bg-slate-100 rounded text-slate-500" style={{ fontFamily: "monospace" }}>Enter</kbd> to send, <kbd className="px-1 py-0.5 bg-slate-100 rounded text-slate-500" style={{ fontFamily: "monospace" }}>Shift+Enter</kbd> for new line
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}