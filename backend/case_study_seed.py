"""Seed data for Meghavi Makhecha case study."""

_IMG = "/case-studies/meghavi"

MEGHAVI_CASE_STUDY = {
    "id": "cs-meghavi-makhecha",
    "slug": "meghavi-makhecha",
    "title": "She Was Told to Amputate. She Chose to Feel Instead.",
    "subtitle": "The 16-month visual story of Meghavi Makhecha",
    "summary": (
        "How releasing suppressed emotions rewired her brain, reset her immune system, "
        "and healed a 14-year diabetic wound that surgery, antibiotics, and skin grafting could not close."
    ),
    "client_name": "Meghavi Makhecha",
    "condition": "14-year chronic diabetic foot wound",
    "hero_image": f"{_IMG}/2026-04-walking.png",
    "program_name": "Atomic Weight Release Program (AWRP)",
    "program_link": "/programs",
    "scientific_reference": (
        'Yi Ru et al., "Immune cells in diabetic wound repair: the key to better wound management," '
        "MedScience, December 2025."
    ),
    "disclaimer": (
        "Meghavi Makhecha's complete medical records and photographic documentation span "
        "June 2012 through April 2026 — fourteen years across multiple hospitals and specialists "
        "in Rajkot, Ahmedabad, and Gujarat, India. AWRP commenced December 2024."
    ),
    "visible": True,
    "featured": True,
    "order": 0,
    "intro_sections": [
        {
            "heading": "What Medicine Could Not Measure",
            "body": (
                "Before we follow what happened next, we need to understand something that the doctors — "
                "good doctors, skilled doctors, doctors who genuinely tried — were not equipped to address.\n\n"
                "Meghavi's wound was not just a wound. It was the physical expression of fourteen years of a body "
                "living in a state of unrelenting alarm.\n\n"
                "For fourteen years, every day, Meghavi woke up to a body in pain, a leg that was failing her, "
                "a wound that refused to close. For fourteen years, her nervous system received the same signal, "
                "over and over: you are not safe. Something is very wrong. This is not over.\n\n"
                "The human nervous system is not designed for fourteen years of emergency. When it cannot find its "
                "way out of the alarm state — when the threat is chronic, when the pain doesn't stop, when the fear "
                "becomes the background noise of every moment — it adapts. It locks itself into survival mode.\n\n"
                "Meghavi had been carrying emotions that had never been allowed to move. The grief of a body that "
                "kept failing her. The fear that lived in every dressing change. The exhaustion of years of fighting. "
                "These are not abstract feelings. They are physiological events.\n\n"
                "A body that is carrying that weight cannot heal. Not because of weakness. Because of biology."
            ),
        },
    ],
    "timeline": [
        {
            "date_label": "June 2012",
            "title": "Where It Began",
            "body": (
                "The wound that would define the next fourteen years of Meghavi's life began in 2012. "
                "Hospital discharge records and early specialist visits document the start of a journey "
                "through diabetic foot care, vascular surgery, and wound management centres across Gujarat."
            ),
            "image_url": f"{_IMG}/2012-discharge.png",
            "images": [f"{_IMG}/2012-first-visit.png", f"{_IMG}/2012-hba1c.png"],
            "phase": "before",
            "order": 0,
        },
        {
            "date_label": "March 2018",
            "title": "Venous Damage Documented",
            "body": (
                "Doppler studies at N.M. Virani Wockhardt Hospital confirmed venous incompetence and "
                "saphenofemoral junction reflux — underlying conditions that conventional medicine monitored "
                "but could not resolve."
            ),
            "image_url": f"{_IMG}/2018-doppler.png",
            "phase": "before",
            "order": 1,
        },
        {
            "date_label": "December 2018",
            "title": "Six Years In — Still Open",
            "body": (
                "Six years into the wound's history, the skin around the ankle remained dark, thickened, "
                "and raw. Surgical fixation was visible. The tissue had the texture of bark on a dying tree."
            ),
            "image_url": f"{_IMG}/2018-12-early-wound.png",
            "phase": "before",
            "order": 2,
        },
        {
            "date_label": "January 2023",
            "title": "The Foot That Medicine Gave Up On",
            "body": (
                "Meghavi Makhecha's left foot tells the whole story in one photograph. The toe is moulded downward — "
                "foot drop. The ankle is split open, raw and bleeding. The skin around it is dark, thickened. "
                "The whole foot looks like something that has been at war with itself for a very long time. "
                "Because it has. For eleven years at that point. And it would not stop."
            ),
            "image_url": f"{_IMG}/2023-01-foot-drop.png",
            "phase": "before",
            "order": 3,
        },
        {
            "date_label": "September 2023",
            "title": "Wrapped Entirely in Bandage",
            "body": (
                "The foot is wrapped entirely in white bandage — thick layers, the kind that signals a wound too raw "
                "to be exposed to air. The toes poke out at the top, darkened and clawed. This was her life: every few "
                "days, someone unwrapped it, cleaned it, dressed it again."
            ),
            "image_url": f"{_IMG}/2023-09-bandaged.png",
            "phase": "before",
            "order": 4,
        },
        {
            "date_label": "January 2024",
            "title": "The Bandage Comes Off — The Wound Remains",
            "body": (
                "Crusting, weeping, yellow-orange discharge crusted over raw red tissue. The wound that had defined "
                "her existence since 2012 was still there."
            ),
            "image_url": f"{_IMG}/2024-01-wound.png",
            "phase": "before",
            "order": 5,
        },
        {
            "date_label": "February 2024",
            "title": "Raw and Inflamed",
            "body": (
                "The skin around the ankle an angry purple-brown. Inflammation that had become permanent — "
                "the body's alarm state made visible."
            ),
            "image_url": f"{_IMG}/2024-02-inflamed.png",
            "phase": "before",
            "order": 6,
        },
        {
            "date_label": "August 2024",
            "title": "Silver Touch Hospital — Skin Graft Attempt",
            "body": (
                "The medical team tries a skin graft — surgery to transplant healthy skin over the wound and finally "
                "force it closed. Meghavi was 48. She had seen a diabetic foot specialist, a vascular surgeon, "
                "a neuroradiologist, a wound management centre, and two major hospitals. Nothing had worked. "
                "Amputation was the next conversation."
            ),
            "image_url": f"{_IMG}/2024-08-xray-foot.png",
            "images": [
                f"{_IMG}/2024-08-xray-ankle.png",
                f"{_IMG}/2024-08-mri-leg.png",
            ],
            "phase": "before",
            "order": 7,
        },
        {
            "date_label": "August 2024",
            "title": "The Labs Told Their Own Story",
            "body": (
                "A body on the edge:\n"
                "• CRP: 43.40 mg/L — eight times the upper limit of normal\n"
                "• Blood glucose: 211.5 mg/dL — dangerously uncontrolled\n"
                "• Pus culture: Enterococcus faecalis, heavy growth\n"
                "• Haemoglobin: 10.3 — anaemic\n"
                "• Albumin: 3.43 — low, meaning her body lacked the basic protein building blocks to heal"
            ),
            "image_url": f"{_IMG}/2024-08-pus-culture.png",
            "images": [
                f"{_IMG}/2024-08-crp-albumin.png",
                f"{_IMG}/2024-08-cbc.png",
                f"{_IMG}/2024-08-biochemistry.png",
            ],
            "phase": "labs",
            "order": 8,
        },
        {
            "date_label": "4 September 2024",
            "title": "The Graft Has Not Held",
            "body": (
                "Two weeks after skin graft surgery, the wound is open again — glistening and raw, "
                "the skin around it bruised and broken. A wound that even surgery could not close."
            ),
            "image_url": f"{_IMG}/2024-09-graft-failed.png",
            "phase": "before",
            "order": 9,
        },
        {
            "date_label": "December 2024",
            "title": "AWRP Begins — Permission to Feel",
            "body": (
                "Something different happened. She found AWRP. This is where the Atomic Weight Release Program began. "
                "Not with a dressing. Not with an antibiotic. Not with a surgery. With something that medicine does not "
                "have a protocol for: permission to feel."
            ),
            "image_url": f"{_IMG}/2024-12-awrp-start.png",
            "phase": "awrp",
            "order": 10,
        },
        {
            "date_label": "January 2025 — Month 1",
            "title": "The Swelling Goes Down",
            "body": (
                "Something extraordinary happens that no antibiotic had ever achieved: the swelling goes down. "
                "For years, Meghavi's left leg had been visibly larger than her right — chronic oedema that compression "
                "bandaging had been trying to manage. Both legs look almost the same. No swelling. Without surgery. "
                "Within the first month. And the bandage came off. She took her first steps."
            ),
            "image_url": f"{_IMG}/2025-01-swelling-resolved.png",
            "phase": "awrp",
            "order": 11,
        },
        {
            "date_label": "9 January 2025 — Month 2",
            "title": "Granulation Tissue Forms",
            "body": (
                "Pink, bumpy, new tissue. Where there had been open wound, sloughing tissue, and surgical debris — "
                "new tissue is forming. The body is building itself back from within. The skin graft that had failed "
                "in August 2024 had left a crater. The AWRP process is filling it in from the body's own regenerative capacity."
            ),
            "image_url": f"{_IMG}/2025-01-granulation.png",
            "phase": "awrp",
            "order": 12,
        },
        {
            "date_label": "15 May 2025 — Month 6",
            "title": "Skin Is Forming",
            "body": (
                "Six months into AWRP. The foot is barely recognisable from the September 2024 post-surgery image. "
                "Skin is forming. The ankle, which had been an open wound for years, is covered. "
                "The tissue is still fragile — but it is closed."
            ),
            "image_url": f"{_IMG}/2025-05-six-months.png",
            "phase": "awrp",
            "order": 13,
        },
        {
            "date_label": "25 June 2025",
            "title": "Healing Continues",
            "body": (
                "Thick new skin forming — scar tissue, yes, but scar tissue is what a wound becomes when it heals. "
                "The bumpy, cobbled texture of granulation tissue maturing into coverage."
            ),
            "image_url": f"{_IMG}/2025-06-healing.png",
            "phase": "awrp",
            "order": 14,
        },
        {
            "date_label": "10 July 2025",
            "title": "Quiet, Steady Progress",
            "body": (
                "The healing continues its quiet, steady progress. What the photographs show is not a dramatic single "
                "moment but the slow, relentless biological process of a body finally given the conditions it needed."
            ),
            "image_url": f"{_IMG}/2025-07-skin-forming.png",
            "phase": "awrp",
            "order": 15,
        },
        {
            "date_label": "10 September 2025 — Month 9",
            "title": "No Longer a Wound — A Scar",
            "body": (
                "Nine months of AWRP. The foot is covered. The wound that had been open, infected, and draining "
                "since 2012 is no longer a wound. It is a scar."
            ),
            "image_url": f"{_IMG}/2025-09-scar.png",
            "phase": "awrp",
            "order": 16,
        },
        {
            "date_label": "22 September 2025",
            "title": "Scarring Consolidates",
            "body": (
                "Skin continues to mature and remodel. Month after month, quietly, the tissue knits itself together."
            ),
            "image_url": f"{_IMG}/2025-09-consolidating.png",
            "phase": "awrp",
            "order": 17,
        },
        {
            "date_label": "24 January 2026",
            "title": "Skin Holds",
            "body": (
                "Both views of the foot: dorsal and lateral. The skin is intact. Significant scarring — "
                "the marks of fourteen years of damage and the body's hard work of repair. "
                "But no open wound. No infection. No drainage."
            ),
            "image_url": f"{_IMG}/2026-01-intact.png",
            "phase": "awrp",
            "order": 18,
        },
        {
            "date_label": "10 March 2026",
            "title": "Standing Alongside Its Twin",
            "body": (
                "Both legs in the same frame. The right leg: normal, unaffected. The left leg: scarred, marked by its "
                "history, but present. Intact. Covered. Standing alongside its twin after years of threatening to be "
                "taken away entirely."
            ),
            "image_url": f"{_IMG}/2026-03-both-legs.png",
            "phase": "awrp",
            "order": 19,
        },
        {
            "date_label": "14 April 2026",
            "title": "2,000 to 3,000 Steps a Day",
            "body": (
                "The foot is down. On the floor. The ankle is visible, scarred but closed. The toes point forward. "
                "She is walking 2,000 to 3,000 steps a day. Not shuffling with support. Not assisted walking. "
                "Steps. Counted steps. Daily steps. The foot that was supposed to be amputated is carrying her through her days."
            ),
            "image_url": f"{_IMG}/2026-04-walking.png",
            "phase": "awrp",
            "order": 20,
        },
    ],
    "closing_sections": [
        {
            "heading": "What Changed — In the Body and Beyond",
            "body": (
                "AWRP did not remove the diabetes. It did not surgically repair venous incompetence. "
                "It did not reverse foot drop or undo years of venous damage.\n\n"
                "What AWRP did was change the environment in which all of that existed. When the suppressed emotional "
                "weight began to release, the nervous system began to shift. The chronic activation that had been keeping "
                "Meghavi's stress hormones elevated and her immune system locked in attack mode began to resolve.\n\n"
                "The wound, which had never received the biological signal to close, received it. And it began to close."
            ),
        },
        {
            "heading": "A Message to Everyone Whose Body Is Still Fighting",
            "body": (
                "If you are living with a wound that won't close — or a body that won't recover — hear this:\n\n"
                "The wound is not the problem. The wound is the message.\n\n"
                "Your body is not broken. It is stuck in a state that makes healing impossible. "
                "And that state is about the nervous system. About the emotions that never got to move. "
                "About the weight that has been living in your tissues since before you had words for it.\n\n"
                "Meghavi's photographs are not just before-and-after images. They are a month-by-month record of a "
                "nervous system finding its way back to safety. The science is starting to catch up. Meghavi already knew."
            ),
        },
    ],
}
