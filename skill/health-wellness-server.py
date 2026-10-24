"""
Satchida Clinical Health, Dermatology & Holistic Wellness Engine (MCP Stdio Server)
Provides verified offline metabolic calculations (BMR, TDEE, macro splits),
trichology & dermatological ingredient matrices, nail deficiency indicators,
and classical Ayurvedic home remedies with pharmaceutical contraindication checks.
Zero-cloud dependencies, evidence-based formulas, runs 100% locally.
Compatible with MCP SDK 2.x (MCPServer).
"""
import sys
import json
import math
from mcp.server.mcpserver import MCPServer

mcp = MCPServer("satchida-health-wellness")

# Curated Food Glycemic & Nutrition Reference Table (per 100g)
NUTRITION_DB = {
    "white_rice_cooked": {"calories": 130, "protein_g": 2.7, "carbs_g": 28.2, "fiber_g": 0.4, "fat_g": 0.3, "gi": 73, "gl": 20, "category": "grain"},
    "brown_rice_cooked": {"calories": 111, "protein_g": 2.6, "carbs_g": 23.0, "fiber_g": 1.8, "fat_g": 0.9, "gi": 68, "gl": 16, "category": "grain"},
    "oats_rolled": {"calories": 389, "protein_g": 16.9, "carbs_g": 66.3, "fiber_g": 10.6, "fat_g": 6.9, "gi": 55, "gl": 13, "category": "grain"},
    "wheat_roti_chapati": {"calories": 297, "protein_g": 9.4, "carbs_g": 52.0, "fiber_g": 9.2, "fat_g": 4.1, "gi": 62, "gl": 15, "category": "bread"},
    "chicken_breast_cooked": {"calories": 165, "protein_g": 31.0, "carbs_g": 0.0, "fiber_g": 0.0, "fat_g": 3.6, "gi": 0, "gl": 0, "category": "protein"},
    "paneer_cottage_cheese": {"calories": 265, "protein_g": 18.3, "carbs_g": 3.4, "fiber_g": 0.0, "fat_g": 20.8, "gi": 10, "gl": 1, "category": "dairy"},
    "boiled_egg": {"calories": 155, "protein_g": 12.6, "carbs_g": 1.1, "fiber_g": 0.0, "fat_g": 10.6, "gi": 0, "gl": 0, "category": "protein"},
    "lentils_dal_cooked": {"calories": 116, "protein_g": 9.0, "carbs_g": 20.1, "fiber_g": 7.9, "fat_g": 0.4, "gi": 32, "gl": 6, "category": "legume"},
    "chickpeas_chana_cooked": {"calories": 164, "protein_g": 8.9, "carbs_g": 27.4, "fiber_g": 7.6, "fat_g": 2.6, "gi": 28, "gl": 8, "category": "legume"},
    "almonds": {"calories": 579, "protein_g": 21.2, "carbs_g": 21.6, "fiber_g": 12.5, "fat_g": 49.9, "gi": 15, "gl": 1, "category": "nuts"},
    "banana": {"calories": 89, "protein_g": 1.1, "carbs_g": 22.8, "fiber_g": 2.6, "fat_g": 0.3, "gi": 51, "gl": 13, "category": "fruit"},
    "apple": {"calories": 52, "protein_g": 0.3, "carbs_g": 13.8, "fiber_g": 2.4, "fat_g": 0.2, "gi": 36, "gl": 6, "category": "fruit"},
    "potato_boiled": {"calories": 87, "protein_g": 1.9, "carbs_g": 20.1, "fiber_g": 1.8, "fat_g": 0.1, "gi": 78, "gl": 21, "category": "vegetable"},
    "spinach_palak": {"calories": 23, "protein_g": 2.9, "carbs_g": 3.6, "fiber_g": 2.2, "fat_g": 0.4, "gi": 15, "gl": 1, "category": "vegetable"}
}

@mcp.tool()
def metabolic_nutrition_planner(
    age: int,
    gender: str,
    weight_kg: float,
    height_cm: float,
    activity_level: str = "moderate",
    goal: str = "maintenance"
) -> str:
    """
    Computes evidence-based BMR (Mifflin-St Jeor), TDEE, target caloric intake,
    macronutrient splits (grams of protein, carbs, and fats), and intermittent fasting intervals.
    gender: 'male' or 'female'
    activity_level options: 'sedentary' (1.2), 'light' (1.375), 'moderate' (1.55), 'very_active' (1.725), 'athlete' (1.9)
    goal options: 'weight_loss_mild' (-300 kcal), 'weight_loss_standard' (-500 kcal), 'weight_loss_aggressive' (-750 kcal), 'muscle_gain' (+350 kcal), 'maintenance'
    """
    try:
        g = gender.lower().strip()
        # Mifflin-St Jeor Formula
        if g in ["male", "m"]:
            bmr = 10.0 * weight_kg + 6.25 * height_cm - 5.0 * age + 5.0
        else:
            bmr = 10.0 * weight_kg + 6.25 * height_cm - 5.0 * age - 161.0
            
        activity_multipliers = {
            "sedentary": 1.2,
            "light": 1.375,
            "moderate": 1.55,
            "very_active": 1.725,
            "athlete": 1.9
        }
        mult = activity_multipliers.get(activity_level.lower().strip(), 1.55)
        tdee = bmr * mult
        
        goal_deltas = {
            "maintenance": 0,
            "weight_loss_mild": -300,
            "weight_loss_standard": -500,
            "weight_loss_aggressive": -750,
            "muscle_gain": 350
        }
        delta = goal_deltas.get(goal.lower().strip(), 0)
        target_calories = max(1200.0 if g == "female" else 1500.0, tdee + delta)
        
        # Macronutrient allocation (High protein for lean tissue preservation)
        # Protein: 1.8g to 2.0g per kg of body weight
        protein_g = min(weight_kg * 2.0, (target_calories * 0.30) / 4.0)
        protein_cals = protein_g * 4.0
        
        # Fat: 25% of target calories
        fat_cals = target_calories * 0.25
        fat_g = fat_cals / 9.0
        
        # Carbohydrates: remaining calories
        carb_cals = max(0, target_calories - (protein_cals + fat_cals))
        carb_g = carb_cals / 4.0
        
        bmi = weight_kg / ((height_cm / 100.0) ** 2)
        bmi_status = "Underweight" if bmi < 18.5 else "Normal weight" if bmi < 25.0 else "Overweight" if bmi < 30.0 else "Obese"

        return json.dumps({
            "status": "success",
            "biometrics": {
                "bmi": round(bmi, 2),
                "classification": bmi_status,
                "bmr_kcal": round(bmr, 0),
                "tdee_maintenance_kcal": round(tdee, 0),
                "target_daily_calories": round(target_calories, 0),
                "daily_caloric_delta": delta
            },
            "macronutrients_daily": {
                "protein_grams": round(protein_g, 1),
                "carbohydrates_grams": round(carb_g, 1),
                "healthy_fats_grams": round(fat_g, 1),
                "calorie_distribution": {
                    "protein_pct": f"{round((protein_cals / target_calories) * 100, 1)}%",
                    "carbs_pct": f"{round((carb_cals / target_calories) * 100, 1)}%",
                    "fat_pct": f"{round((fat_cals / target_calories) * 100, 1)}%"
                }
            },
            "intermittent_fasting_protocol": {
                "recommended_protocol": "16:8 Leangains Method",
                "eating_window": "12:00 PM to 8:00 PM",
                "fasting_window": "8:00 PM to 12:00 PM (16 hours water/black tea/black coffee only)"
            }
        }, indent=2)
    except Exception as e:
        return json.dumps({"status": "error", "message": str(e)})

@mcp.tool()
def skin_hair_and_nail_care(
    skin_concerns: list = None,
    skin_type: str = "combination",
    hair_porosity: str = "medium",
    nail_symptoms: list = None
) -> str:
    """
    Evaluates skincare active compatibility, comedogenic ratings, hair porosity care, and nail clinical flags.
    skin_concerns example: ['acne', 'hyperpigmentation', 'fine_lines']
    hair_porosity options: 'low', 'medium', 'high'
    nail_symptoms example: ['brittle_splitting', 'white_spots', 'ridges']
    """
    try:
        # Incompatible Ingredient Combinations Rulebook
        ingredient_incompatibilities = [
            {"pair": ["Retinol / Retinoids", "AHA / BHA Acids"], "warning": "High risk of skin barrier destruction, erythema, and severe peeling. Alternate AM/PM or use on separate days."},
            {"pair": ["Retinol / Retinoids", "Benzoyl Peroxide"], "warning": "Benzoyl peroxide oxidizes and deactivates tretinoin/retinol. Use BP in the morning and Retinol at night."},
            {"pair": ["Pure Vitamin C (L-Ascorbic Acid)", "Niacinamide (High Dose)"], "warning": "Can form nickel/nicotinic acid complexes in low pH causing facial flushing and temporary redness."},
            {"pair": ["AHA / BHA Exfoliants", "Physical Scrubs"], "warning": "Excessive micro-tears leading to contact dermatitis and moisture loss."}
        ]
        
        # Comedogenic Ratings (0 to 5)
        comedogenic_table = {
            "Squalane Oil": {"rating": 0, "safety": "Completely non-comedogenic, excellent for acne-prone skin"},
            "Mineral Oil / Petrolatum": {"rating": 0, "safety": "Non-comedogenic barrier occlusive (slugging safe)"},
            "Jojoba Oil": {"rating": 2, "safety": "Mimics human sebum, generally safe for normal/combination"},
            "Shea Butter": {"rating": 2, "safety": "Rich emollient, great for dry body skin, patch test on facial acne"},
            "Coconut Oil (Cocos Nucifera)": {"rating": 4, "safety": "Highly comedogenic for face. Severe pore-clogging risk for acne-prone skin."}
        }
        
        # Hair Porosity Routine
        hair_protocols = {
            "low": {
                "characteristics": "Cuticles tightly closed; water beads on strands; products sit on hair rather than absorbing.",
                "care_protocol": "Use lightweight oils (Argan, Jojoba); use warm water or steam to lift cuticles before deep conditioning; avoid heavy proteins."
            },
            "medium": {
                "characteristics": "Balanced cuticle layer; absorbs and retains moisture predictably.",
                "care_protocol": "Standard moisture and protein balance; routine washing with mild sulfates/sulfate-free cleansers."
            },
            "high": {
                "characteristics": "Gaps and holes in cuticles; absorbs moisture instantly but loses it immediately; prone to frizz and breakage.",
                "care_protocol": "LCO/LOC method (Liquid, Cream, Oil); rich sealants (Castor oil, Shea butter); monthly hydrolysed protein masks to patch cuticle gaps."
            }
        }
        porosity_guide = hair_protocols.get(hair_porosity.lower().strip(), hair_protocols["medium"])
        
        # Nail Diagnostic Heuristics
        nail_deficiencies = {
            "brittle_splitting": "Frequent water exposure, Biotin deficiency, Zinc deficiency, or hypothyroidism.",
            "white_spots": "Leukonychia - usually benign minor matrix micro-trauma, occasionally zinc/calcium deficiency.",
            "longitudinal_ridges": "Vertical ridges are often normal physiological aging; deep grooves warrant thyroid/nutrient evaluation.",
            "spoon_shaped_koilonychia": "Strong clinical indicator of Iron-Deficiency Anemia. Requires serum ferritin blood test."
        }
        nail_feedback = {}
        if nail_symptoms:
            for s in nail_symptoms:
                s_key = s.lower().strip().replace(" ", "_")
                if s_key in nail_deficiencies:
                    nail_feedback[s] = nail_deficiencies[s_key]

        return json.dumps({
            "status": "success",
            "skin_type": skin_type,
            "ingredient_safety_rules": ingredient_incompatibilities,
            "comedogenic_index_reference": comedogenic_table,
            "hair_porosity_strategy": {
                "porosity": hair_porosity,
                "guidelines": porosity_guide
            },
            "nail_clinical_observations": nail_feedback if nail_feedback else "No red flags noted. Maintain balanced protein, zinc, and iron intake."
        }, indent=2)
    except Exception as e:
        return json.dumps({"status": "error", "message": str(e)})

@mcp.tool()
def ayurvedic_dosha_and_home_remedies(
    dosha_or_prakriti: str = "pitta",
    ailment: str = "general_wellness"
) -> str:
    """
    Provides classical Ayurvedic holistic guidance, daily Dinacharya, herbal home decoctions (Kadha, Triphala),
    and critical contraindications with modern prescription medications.
    dosha_or_prakriti: 'vata', 'pitta', 'kapha'
    ailment options: 'respiratory_cold', 'digestive_sluggishness', 'inflammation_joint', 'insomnia_stress', 'general_wellness'
    """
    try:
        dosha = dosha_or_prakriti.lower().strip()
        
        dosha_characteristics = {
            "vata": {
                "elements": "Space & Air",
                "qualities": "Dry, light, cold, rough, mobile.",
                "balancing_diet": "Warm, unctuous (healthy fats, ghee), cooked nourishing foods, sweet, sour, salty tastes.",
                "lifestyle": "Regular routine, warm sesame oil Abhyanga massage, grounding meditation, adequate sleep."
            },
            "pitta": {
                "elements": "Fire & Water",
                "qualities": "Hot, sharp, light, oily, penetrating.",
                "balancing_diet": "Cooling foods, sweet, bitter, astringent tastes; coconut water, cucumber, coriander, mint; avoid excessive chili/fried foods.",
                "lifestyle": "Avoid excessive direct sun/heat, practice sheetali pranayama, sandalwood cooling applications."
            },
            "kapha": {
                "elements": "Water & Earth",
                "qualities": "Heavy, slow, cool, oily, dense.",
                "balancing_diet": "Light, warm, dry foods, pungent, bitter, astringent tastes; black pepper, ginger, fenugreek, honey; minimize dairy and refined sugar.",
                "lifestyle": "Vigorous aerobic exercise, dry brushing (Garshana), early rising before 6:00 AM."
            }
        }
        
        remedies_db = {
            "respiratory_cold": {
                "recipe": "Classical Ayush Kwath / Kadha: Boil 4 parts Tulsi leaves, 2 parts crushed Ginger (Sunthi), 2 parts Cinnamon (Dalchini), and 1 part Black Pepper (Maricha) in 500ml water down to 250ml. Add raw honey once lukewarm.",
                "mechanism": "Tulsi provides eugenol antiviral support; piperine enhances thermogenesis and liquefies mucus.",
                "contraindication": "Avoid boiling honey directly (creates toxic HMF). Patients with active gastric ulcers should reduce black pepper."
            },
            "digestive_sluggishness": {
                "recipe": "Triphala Churna: 1/2 teaspoon of Triphala powder (equal parts Amalaki, Bibhitaki, Haritaki) in warm water at bedtime.",
                "mechanism": "Gently stimulates intestinal peristalsis without the bowel dependence caused by senna.",
                "contraindication": "Do not consume during acute diarrhea or pregnancy."
            },
            "inflammation_joint": {
                "recipe": "Golden Turmeric Milk (Haldi Doodh): 1/2 tsp organic turmeric + pinch of black pepper + 1/4 tsp pure cow ghee in warm milk.",
                "mechanism": "Piperine increases curcumin bioavailability by up to 2000%; ghee liposomes enable lymphatic absorption.",
                "contraindication": "Caution in patients taking blood thinners (Warfarin/Aspirin) or those with active gallstones (cholelithiasis)."
            },
            "insomnia_stress": {
                "recipe": "Ashwagandha Ksheerapaka: 3g Ashwagandha root powder simmered in warm milk with a pinch of nutmeg (Jaiphal).",
                "mechanism": "Withanolides act as GABA-mimetics, reducing serum cortisol and calming HPA axis hyperactivity.",
                "contraindication": "Contraindicated in autoimmune disorders, active hyperthyroidism, and concurrent sedative medication."
            },
            "general_wellness": {
                "recipe": "Amla (Indian Gooseberry) fresh juice or Chyawanprash: 15ml fresh amla juice with equal water on an empty stomach.",
                "mechanism": "Exceptionally dense source of heat-stable Vitamin C and ellagitannin polyphenols for mucosal immunity.",
                "contraindication": "Safe for universal daily consumption."
            }
        }
        
        d_info = dosha_characteristics.get(dosha, dosha_characteristics["pitta"])
        r_info = remedies_db.get(ailment.lower().strip(), remedies_db["general_wellness"])

        return json.dumps({
            "status": "success",
            "dosha_profile": {
                "dosha": dosha,
                "profile": d_info
            },
            "targeted_remedy": {
                "condition": ailment,
                "formulation": r_info["recipe"],
                "biochemical_mechanism": r_info["mechanism"],
                "clinical_contraindications": r_info["contraindication"]
            }
        }, indent=2)
    except Exception as e:
        return json.dumps({"status": "error", "message": str(e)})

@mcp.tool()
def glycemic_and_calorie_lookup(food_items: list) -> str:
    """
    Look up calories, macronutrients, Glycemic Index (GI), and Glycemic Load (GL) for a list of common foods.
    food_items example: ['white_rice_cooked', 'chicken_breast_cooked', 'paneer_cottage_cheese', 'banana']
    """
    try:
        results = {}
        for item in food_items:
            key = item.lower().strip().replace(" ", "_")
            if key in NUTRITION_DB:
                results[item] = NUTRITION_DB[key]
            else:
                matches = [k for k in NUTRITION_DB.keys() if key in k]
                if matches:
                    results[item] = NUTRITION_DB[matches[0]]
                else:
                    results[item] = "Not found in offline reference table. Available: " + ", ".join(list(NUTRITION_DB.keys())[:8])

        return json.dumps({
            "status": "success",
            "items_queried": len(food_items),
            "nutrition_data": results
        }, indent=2)
    except Exception as e:
        return json.dumps({"status": "error", "message": str(e)})

# Curated Classical Yoga Asanas and Pranayama Database
YOGA_DB = {
    "surya_namaskar": {
        "sanskrit": "Surya Namaskar",
        "english": "Sun Salutation (12-Step Dynamic Flow)",
        "category": "sequence",
        "difficulty": "beginner",
        "benefits": ["Full-body cardiovascular warm-up", "Spinal flexibility", "Stimulates lymphatic circulation", "Metabolic activation"],
        "cues": "Flow through 12 postures synchronizing with breath: Pranamasana (exhale), Hastauttanasana (inhale), Padahastasana (exhale), Ashwa Sanchalanasana (inhale), Dandasana (hold), Ashtanga Namaskara (exhale), Bhujangasana (inhale), Parvatasana/Adho Mukha (exhale), Ashwa Sanchalanasana (inhale), Padahastasana (exhale), Hastauttanasana (inhale), Pranamasana (exhale).",
        "contraindications": ["Severe hypertension", "Active wrist fracture", "Acute lumbar disc herniation", "Late pregnancy (modify with chair/wall)."]
    },
    "tadasana": {
        "sanskrit": "Tadasana",
        "english": "Mountain Pose",
        "category": "standing",
        "difficulty": "beginner",
        "benefits": ["Postural alignment", "Strengthens thighs, knees, and ankles", "Firms abdomen and buttocks", "Reduces flat feet"],
        "cues": "Stand with big toes touching, heels slightly apart. Ground through all four corners of the feet. Engage quadriceps, lengthen spine upward through crown of head, shoulders relaxed down.",
        "contraindications": ["Acute headache", "Severe low blood pressure / dizziness."]
    },
    "vrikshasana": {
        "sanskrit": "Vrikshasana",
        "english": "Tree Pose",
        "category": "standing_balance",
        "difficulty": "beginner",
        "benefits": ["Neuromuscular balance and proprioception", "Strengthens ankles, calves, and spine", "Tones groin and inner thighs"],
        "cues": "Shift weight onto left foot. Place sole of right foot against inner left calf or inner thigh (never directly on knee joint). Press hands together at heart center or extend overhead.",
        "contraindications": ["Acute inner ear balance disorders", "Severe knee instability."]
    },
    "trikonasana": {
        "sanskrit": "Utthita Trikonasana",
        "english": "Extended Triangle Pose",
        "category": "standing",
        "difficulty": "beginner",
        "benefits": ["Stretches hamstrings, groin, and hips", "Expands chest and shoulders", "Stimulates abdominal organs", "Relieves backache"],
        "cues": "Legs 3-4 feet apart. Turn right foot 90 degrees outward. Inhale arms parallel, exhale reach right torso forward, place right hand on shin or block, extend left arm toward ceiling.",
        "contraindications": ["Severe cervical spine injury (look down instead of up)", "Acute diarrhea."]
    },
    "bhujangasana": {
        "sanskrit": "Bhujangasana",
        "english": "Cobra Pose",
        "category": "prone_backbend",
        "difficulty": "beginner",
        "benefits": ["Strengthens spinal erectors", "Stretches chest, lungs, and abdomen", "Stimulates adrenal glands", "Therapeutic for mild asthma"],
        "cues": "Lie prone, tops of feet grounded. Place hands under shoulders, elbows hugged into ribs. Inhale to lift chest using spinal muscles rather than pushing through hands. Keep pubic bone grounded.",
        "contraindications": ["Pregnancy", "Carpal tunnel syndrome", "Acute lumbar disc slip (herniation)."]
    },
    "dhanurasana": {
        "sanskrit": "Dhanurasana",
        "english": "Bow Pose",
        "category": "prone_backbend",
        "difficulty": "intermediate",
        "benefits": ["Strengthens back muscles", "Massages abdominal organs to aid digestion and constipation", "Opens chest and hip flexors"],
        "cues": "Lie prone. Bend knees and grasp outside of ankles. Inhale, kick shins back to lift chest and thighs off floor. Keep gaze forward and breathe evenly.",
        "contraindications": ["High or low blood pressure", "Abdominal hernia", "Recent abdominal surgery", "Pregnancy."]
    },
    "paschimottanasana": {
        "sanskrit": "Paschimottanasana",
        "english": "Seated Forward Bend",
        "category": "seated",
        "difficulty": "beginner",
        "benefits": ["Deep stretch for posterior chain (hamstrings, calves, spine)", "Calms central nervous system", "Stimulates liver and kidneys"],
        "cues": "Sit tall with legs extended straight. Flex feet. Inhale reach arms overhead, exhale hinge from hips keeping spine long. Hold shins, ankles, or feet. Avoid rounding thoracic spine excessively.",
        "contraindications": ["Acute sciatica flare-up", "Lumbar disc bulge / herniation (keep knees soft and spine neutral)."]
    },
    "ardha_matsyendrasana": {
        "sanskrit": "Ardha Matsyendrasana",
        "english": "Half Lord of the Fishes (Spinal Twist)",
        "category": "seated_twist",
        "difficulty": "intermediate",
        "benefits": ["Spinal rotational mobility", "Stimulates digestion and pancreas", "Relieves lower back stiffness", "Opens chest and shoulders"],
        "cues": "Seated with legs bent. Step right foot over left knee. Inhale lengthen spine, exhale rotate torso to right, placing left elbow outside right knee and right hand on floor behind sacrum.",
        "contraindications": ["Severe spinal or sacroiliac joint injury", "Third trimester of pregnancy."]
    },
    "sarvangasana": {
        "sanskrit": "Salamba Sarvangasana",
        "english": "Supported Shoulderstand",
        "category": "inversion",
        "difficulty": "advanced",
        "benefits": ["Stimulates thyroid and parathyroid glands", "Promotes venous blood return from lower limbs", "Calms brain and relieves stress"],
        "cues": "From supine, engage core to lift legs and hips overhead. Support mid-back with hands, elbows tucked shoulder-width apart. Extend legs vertically, resting weight on shoulders and upper arms, NEVER on cervical neck.",
        "contraindications": ["High blood pressure", "Glaucoma or detached retina", "Cervical spondylosis / neck injuries", "Menstruation."]
    },
    "halasana": {
        "sanskrit": "Halasana",
        "english": "Plow Pose",
        "category": "inversion",
        "difficulty": "intermediate",
        "benefits": ["Stretches entire spine and shoulder girdle", "Stimulates abdominal organs", "Helps relieve menopause symptoms and fatigue"],
        "cues": "From shoulderstand, slowly hinge from hips to lower toes to floor behind head. Keep legs straight and spine vertical. Interlace fingers behind back if comfortable.",
        "contraindications": ["Cervical spine injuries", "High blood pressure", "Pregnancy."]
    },
    "setu_bandhasana": {
        "sanskrit": "Setu Bandha Sarvangasana",
        "english": "Bridge Pose",
        "category": "supine_backbend",
        "difficulty": "beginner",
        "benefits": ["Strengthens glutes and hamstrings", "Opens chest, heart, and hip flexors", "Therapeutic for mild depression and anxiety"],
        "cues": "Lie on back, bend knees with feet flat hip-width apart. Press into feet to lift hips toward ceiling. Interlace fingers under back and roll shoulders under.",
        "contraindications": ["Severe neck injury (support with folded blanket under shoulders)."]
    },
    "balasana": {
        "sanskrit": "Balasana",
        "english": "Child's Pose",
        "category": "restorative",
        "difficulty": "beginner",
        "benefits": ["Gently stretches hips, thighs, and ankles", "Relieves back and neck strain", "Calms mind and relieves stress"],
        "cues": "Kneel on floor with big toes touching, knees wide. Fold torso forward between thighs, resting forehead on mat. Extend arms forward or alongside torso.",
        "contraindications": ["Severe knee injury", "Third trimester pregnancy (keep knees wide)."]
    },
    "shavasana": {
        "sanskrit": "Shavasana",
        "english": "Corpse Pose",
        "category": "restorative",
        "difficulty": "beginner",
        "benefits": ["Complete parasympathetic nervous system restoration", "Reduces blood pressure and heart rate", "Integrates physical practice benefits"],
        "cues": "Lie flat on back. Feet fall naturally open. Arms slightly away from torso with palms facing upward. Close eyes and release all muscular tension.",
        "contraindications": ["None. Modify with bolster under knees for lower back pain."]
    },
    "pranayama_nadi_shodhana": {
        "sanskrit": "Nadi Shodhana Pranayama",
        "english": "Alternate Nostril Breathing (Anulom Vilom)",
        "category": "pranayama",
        "difficulty": "beginner",
        "benefits": ["Balances sympathetic and parasympathetic nervous systems", "Purifies energetic nadis (Ida and Pingala)", "Reduces anxiety and improves mental clarity"],
        "cues": "Sit comfortably with erect spine. Use Vishnu Mudra (right hand). Close right nostril with thumb, inhale through left nostril for 4 counts. Close left nostril with ring finger, release right thumb, exhale for 4 counts. Inhale through right for 4, exhale through left for 4. Continue for 5-10 minutes.",
        "contraindications": ["Completely safe for all individuals. Avoid kumbhaka (breath retention) during hypertension or pregnancy."]
    },
    "pranayama_kapalabhati": {
        "sanskrit": "Kapalabhati Pranayama",
        "english": "Skull Shining Breath (Frontal Brain Cleansing)",
        "category": "pranayama",
        "difficulty": "intermediate",
        "benefits": ["Cleanses respiratory sinuses", "Strengthens abdominal muscles", "Stimulates sluggish digestion and metabolic rate", "Energizes mind"],
        "cues": "Sit with tall spine. Take a deep passive inhale, followed by rapid, forceful, active contractions of the lower abdomen to exhale sharply through the nose. Inhalation occurs passively between contractions. Practice 20-30 pumping strokes per round.",
        "contraindications": ["Hypertension or heart disease", "Hernia or gastric ulcers", "Epilepsy", "Pregnancy."]
    },
    "pranayama_bhramari": {
        "sanskrit": "Bhramari Pranayama",
        "english": "Humming Bee Breath (Vagal Tone Stimulator)",
        "category": "pranayama",
        "difficulty": "beginner",
        "benefits": ["Stimulates nitric oxide production in paranasal sinuses (15x increase)", "Vibrational stimulation of vagus nerve", "Rapidly reduces anger, agitation, and insomnia"],
        "cues": "Sit upright. Close ears with thumbs and place index fingers over eyebrows, remaining fingers over eyes (Shanmukhi mudra). Inhale deeply through nose, exhale making a steady, smooth, low-pitched humming sound 'Mmmmm' feeling the vibration in the cranium.",
        "contraindications": ["Active ear infection / suppurative otitis media."]
    }
}

@mcp.tool()
def yoga_asana_and_pranayama_guide(
    search_query: str = "all",
    target_benefit: str = None,
    difficulty: str = None,
    health_condition: str = None
) -> str:
    """
    Comprehensive classical Yoga Asana & Pranayama reference guide.
    Provides alignment cues, anatomical focus, therapeutic benefits, and critical clinical contraindications.
    search_query: specific asana name ('bhujangasana', 'surya_namaskar', 'pranayama', 'tadasana') or 'all'
    target_benefit options: 'back_pain', 'flexibility', 'digestion', 'stress_relief', 'blood_pressure', 'spine'
    difficulty options: 'beginner', 'intermediate', 'advanced'
    health_condition: checks contraindications ('hypertension', 'disc_herniation', 'pregnancy', 'cervical', 'glaucoma')
    """
    try:
        q = search_query.lower().strip().replace(" ", "_")
        matched = {}

        for key, data in YOGA_DB.items():
            # Name match
            name_match = (q == "all" or q in key or q in data["sanskrit"].lower() or q in data["english"].lower() or q in data["category"])
            
            # Benefit filter
            benefit_match = True
            if target_benefit:
                tb = target_benefit.lower().strip().replace(" ", "_")
                benefit_text = " ".join(data["benefits"]).lower()
                benefit_match = tb in benefit_text or (tb == "back_pain" and ("back" in benefit_text or "spine" in benefit_text))

            # Difficulty filter
            diff_match = True
            if difficulty:
                diff_match = (data["difficulty"].lower() == difficulty.lower().strip())

            # Health condition contraindication flag
            contra_flag = None
            if health_condition:
                hc = health_condition.lower().strip()
                contra_text = " ".join(data["contraindications"]).lower()
                if hc in contra_text or (hc == "disc_herniation" and ("disc" in contra_text or "hernia" in contra_text)):
                    contra_flag = f"WARNING: Contraindicated for {health_condition}!"

            if name_match and benefit_match and diff_match:
                entry = dict(data)
                if contra_flag:
                    entry["CLINICAL_SAFETY_ALERT"] = contra_flag
                matched[key] = entry

        return json.dumps({
            "status": "success",
            "results_count": len(matched),
            "filters_applied": {
                "query": search_query,
                "target_benefit": target_benefit,
                "difficulty": difficulty,
                "health_condition": health_condition
            },
            "asanas_and_pranayama": matched
        }, indent=2)
    except Exception as e:
        return json.dumps({"status": "error", "message": str(e)})

if __name__ == "__main__":
    mcp.run()
