export default function Home() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-4xl font-bold mb-4">Healthy Recipes Blog</h1>
      <p className="text-gray-600 mb-8">
        Delicious and nutritious recipes for a healthier you. Powered by
        AgentSense.
      </p>

      <div className="space-y-6">
        <article className="border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-2">
            High Protein Breakfast Ideas
          </h2>
          <p className="text-gray-600 text-sm mb-3">
            Start your day right with these protein-packed breakfast recipes
            that will keep you energized until lunch.
          </p>
          <p className="text-xs text-gray-400">
            Agent access: GET /api/content?q=high+protein+breakfast
          </p>
        </article>

        <article className="border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-2">
            Quick Fitness Meal Prep Guide
          </h2>
          <p className="text-gray-600 text-sm mb-3">
            Meal prep like a pro with these easy, nutritious recipes designed
            for fitness enthusiasts.
          </p>
          <p className="text-xs text-gray-400">
            Agent access: GET /api/content?q=fitness+meal+prep
          </p>
        </article>

        <article className="border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-2">
            Best Smoothie Recipes for Recovery
          </h2>
          <p className="text-gray-600 text-sm mb-3">
            Post-workout smoothie recipes loaded with protein, vitamins, and
            antioxidants.
          </p>
          <p className="text-xs text-gray-400">
            Agent access: GET /api/content?q=protein+smoothie+recovery
          </p>
        </article>
      </div>

      <div className="mt-10 p-4 bg-blue-50 rounded-lg text-sm text-blue-800">
        <strong>AgentSense enabled:</strong> This blog monetizes agent queries
        via x402 payments on Stellar. Agents pay $0.01 USDC per query.
      </div>
    </main>
  )
}
