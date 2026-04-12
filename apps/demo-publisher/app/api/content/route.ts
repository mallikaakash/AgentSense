// GET /api/content — AgentSense gated content endpoint
// x402 payment handled entirely by @agentsense/middleware
// Price ($0.01 USDC/query) set by platform, publisher earns via wallet

import { agentGate } from "@agentsense/middleware"

const PUBLISHER_WALLET = process.env.PUBLISHER_WALLET || "GCM5SIFSH3ZB2BITJNP46SD7L4T2FPGNQJ3KHWG4RBHQTNG4PPKNUJQZ"
const PLATFORM_URL = process.env.PLATFORM_URL || "http://localhost:3000"

const articles: Record<string, { title: string; body: string; tags: string[] }> = {
  "high protein breakfast": {
    title: "High Protein Breakfast Ideas",
    body: `Start your day with these protein-packed breakfast options:

1. **Greek Yogurt Parfait** - Layer Greek yogurt with granola, berries, and a drizzle of honey. 20g protein per serving.

2. **Egg White Omelette** - Fill with spinach, mushrooms, and feta cheese. 25g protein per serving.

3. **Overnight Protein Oats** - Mix oats with protein powder, chia seeds, and almond milk. Refrigerate overnight. 30g protein per serving.

4. **Cottage Cheese Pancakes** - Blend cottage cheese with eggs and oats for fluffy, protein-rich pancakes. 22g protein per serving.

5. **Smoked Salmon Toast** - Whole grain toast with cream cheese, smoked salmon, capers, and dill. 18g protein per serving.

Each recipe takes under 15 minutes to prepare and will keep you full until lunch.`,
    tags: ["protein", "breakfast", "recipe", "health", "nutrition"],
  },
  "fitness meal prep": {
    title: "Quick Fitness Meal Prep Guide",
    body: `Master meal prep with these fitness-focused recipes:

**Sunday Prep Plan (serves 5 days):**

- **Grilled Chicken & Quinoa Bowls** - Season chicken breasts with paprika and garlic. Grill, slice, and pair with quinoa and roasted vegetables.

- **Turkey Meatballs** - Mix ground turkey with breadcrumbs, egg, and Italian seasoning. Bake at 400F for 20 minutes. Great with brown rice.

- **Salmon & Sweet Potato** - Bake salmon fillets with lemon and dill. Roast sweet potato cubes alongside.

**Storage Tips:**
- Glass containers keep food fresh longer
- Separate wet and dry ingredients
- Most preps last 4-5 days refrigerated`,
    tags: ["fitness", "meal prep", "recipe", "nutrition", "health"],
  },
  "protein smoothie": {
    title: "Best Smoothie Recipes for Recovery",
    body: `Post-workout recovery smoothies packed with nutrition:

1. **Chocolate Peanut Butter Power** - Banana, chocolate protein powder, peanut butter, oat milk, ice. 35g protein.

2. **Berry Blast Recovery** - Mixed berries, vanilla protein, Greek yogurt, spinach, coconut water. 28g protein.

3. **Green Machine** - Spinach, banana, avocado, protein powder, almond milk, honey. 25g protein.

4. **Tropical Recovery** - Mango, pineapple, coconut milk, vanilla protein, turmeric. 22g protein.

Drink within 30 minutes post-workout for optimal recovery.`,
    tags: ["protein", "smoothie", "recipe", "fitness", "recovery"],
  },
}

function findArticle(query: string) {
  const queryLower = query.toLowerCase()
  for (const [key, article] of Object.entries(articles)) {
    if (queryLower.includes(key)) return article
  }
  for (const article of Object.values(articles)) {
    const matchCount = article.tags.filter((tag) => queryLower.includes(tag)).length
    if (matchCount >= 2) return article
  }
  return Object.values(articles)[0]
}

export const GET = agentGate(
  {
    wallet: PUBLISHER_WALLET,
    platformUrl: PLATFORM_URL,
  },
  async (request: Request) => {
    const url = new URL(request.url)
    const query = url.searchParams.get("q") || url.searchParams.get("query") || "protein breakfast"
    return findArticle(query)
  }
)