// In-memory data store for AgentSense platform
// Seeded with demo data for immediate demo-ability

export interface Publisher {
  id: string
  name: string
  domain: string
  walletAddress: string
  totalEarnings: number
  totalQueries: number
  createdAt: string
}

export interface Advertiser {
  id: string
  name: string
  walletAddress: string
  createdAt: string
}

export interface Session {
  id: string
  advertiserId: string
  keywords: string[]
  bidPerQuery: number
  totalBudget: number
  remainingBudget: number
  sponsoredContent: string
  status: "active" | "paused" | "depleted" | "closed"
  queriesMatched: number
  createdAt: string
  updatedAt: string
}

export interface QueryLog {
  id: string
  publisherId: string
  sessionId: string | null
  query: string
  txHash: string | null
  publisherPayment: number
  adPayment: number
  sponsoredContent: string | null
  advertiserId: string | null
  createdAt: string
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

class Store {
  publishers = new Map<string, Publisher>()
  advertisers = new Map<string, Advertiser>()
  sessions = new Map<string, Session>()
  queries: QueryLog[] = []

  constructor() {
    this.seed()
  }

  private seed() {
    // Demo publisher: a recipe blog
    this.publishers.set("pub_recipes", {
      id: "pub_recipes",
      name: "Healthy Recipes Blog",
      domain: "localhost:3002",
      walletAddress: process.env.PUBLISHER_WALLET || "GDEMO_PUBLISHER",
      totalEarnings: 0,
      totalQueries: 0,
      createdAt: new Date().toISOString(),
    })

    // Demo advertiser: protein supplement brand
    this.advertisers.set("adv_muscleblaze", {
      id: "adv_muscleblaze",
      name: "MuscleBlaze Protein",
      walletAddress: process.env.ADVERTISER_WALLET || "GDEMO_ADVERTISER",
      createdAt: new Date().toISOString(),
    })

    // Demo session: MuscleBlaze targeting health/fitness keywords
    this.sessions.set("session_mb_1", {
      id: "session_mb_1",
      advertiserId: "adv_muscleblaze",
      keywords: [
        "protein",
        "fitness",
        "recipe",
        "breakfast",
        "health",
        "nutrition",
        "muscle",
        "workout",
      ],
      bidPerQuery: 0.005,
      totalBudget: 5.0,
      remainingBudget: 5.0,
      sponsoredContent:
        "MuscleBlaze Protein -- India's #1 protein supplement. Get 20% off with code AGENT20 at muscleblaze.com",
      status: "active",
      queriesMatched: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }

  // --- Publisher methods ---

  registerPublisher(data: {
    id: string
    name: string
    domain: string
    walletAddress: string
  }): Publisher {
    const publisher: Publisher = {
      ...data,
      totalEarnings: 0,
      totalQueries: 0,
      createdAt: new Date().toISOString(),
    }
    this.publishers.set(data.id, publisher)
    return publisher
  }

  getPublisher(id: string): Publisher | undefined {
    return this.publishers.get(id)
  }

  getPublisherByWallet(walletAddress: string): Publisher | undefined {
    return Array.from(this.publishers.values()).find(
      (p) => p.walletAddress === walletAddress
    )
  }

  getAllPublishers(): Publisher[] {
    return Array.from(this.publishers.values())
  }

  recordPublisherPayment(publisherId: string, amount: number) {
    const pub = this.publishers.get(publisherId)
    if (pub) {
      pub.totalEarnings += amount
      pub.totalQueries += 1
    }
  }

  // --- Advertiser methods ---

  registerAdvertiser(data: {
    id: string
    name: string
    walletAddress: string
  }): Advertiser {
    const advertiser: Advertiser = {
      ...data,
      createdAt: new Date().toISOString(),
    }
    this.advertisers.set(data.id, advertiser)
    return advertiser
  }

  getAdvertiser(id: string): Advertiser | undefined {
    return this.advertisers.get(id)
  }

  // --- Session methods ---

  createSession(data: {
    advertiserId: string
    keywords: string[]
    bidPerQuery: number
    totalBudget: number
    sponsoredContent: string
  }): Session {
    const id = generateId("session")
    const session: Session = {
      id,
      advertiserId: data.advertiserId,
      keywords: data.keywords,
      bidPerQuery: data.bidPerQuery,
      totalBudget: data.totalBudget,
      remainingBudget: data.totalBudget,
      sponsoredContent: data.sponsoredContent,
      status: "active",
      queriesMatched: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    this.sessions.set(id, session)
    return session
  }

  getSession(id: string): Session | undefined {
    return this.sessions.get(id)
  }

  getSessionsForAdvertiser(advertiserId: string): Session[] {
    return Array.from(this.sessions.values()).filter(
      (s) => s.advertiserId === advertiserId
    )
  }

  getActiveSessions(): Session[] {
    return Array.from(this.sessions.values()).filter(
      (s) => s.status === "active"
    )
  }

  deductSessionBudget(sessionId: string, amount: number): boolean {
    const session = this.sessions.get(sessionId)
    if (!session || session.status !== "active") return false
    if (session.remainingBudget < amount) return false

    session.remainingBudget -= amount
    session.queriesMatched += 1
    session.updatedAt = new Date().toISOString()

    if (session.remainingBudget < session.bidPerQuery) {
      session.status = "depleted"
    }

    return true
  }

  // --- Auction ---

  runAuction(
    query: string,
    publisherId: string
  ): {
    session: Session | null
    sponsoredContent: string | null
    deductedAmount: number
  } {
    const activeSessions = this.getActiveSessions()
    const queryLower = query.toLowerCase()

    // Find sessions with matching keywords
    const matching = activeSessions.filter((session) =>
      session.keywords.some((kw) => queryLower.includes(kw.toLowerCase()))
    )

    if (matching.length === 0) {
      return { session: null, sponsoredContent: null, deductedAmount: 0 }
    }

    // Highest bid wins
    const winner = matching.reduce((best, current) =>
      current.bidPerQuery > best.bidPerQuery ? current : best
    )

    // Check budget
    if (winner.remainingBudget < winner.bidPerQuery) {
      return { session: null, sponsoredContent: null, deductedAmount: 0 }
    }

    // Deduct budget
    const deducted = this.deductSessionBudget(winner.id, winner.bidPerQuery)
    if (!deducted) {
      return { session: null, sponsoredContent: null, deductedAmount: 0 }
    }

    return {
      session: winner,
      sponsoredContent: winner.sponsoredContent,
      deductedAmount: winner.bidPerQuery,
    }
  }

  // --- Query logging ---

  logQuery(data: {
    publisherId: string
    sessionId: string | null
    query: string
    txHash: string | null
    publisherPayment: number
    adPayment: number
    sponsoredContent: string | null
    advertiserId: string | null
  }): QueryLog {
    const log: QueryLog = {
      id: generateId("q"),
      ...data,
      createdAt: new Date().toISOString(),
    }
    this.queries.unshift(log) // newest first
    return log
  }

  getQueriesForPublisher(publisherId: string): QueryLog[] {
    return this.queries.filter((q) => q.publisherId === publisherId)
  }

  getQueriesForAdvertiser(advertiserId: string): QueryLog[] {
    return this.queries.filter((q) => q.advertiserId === advertiserId)
  }

  getRecentQueries(limit = 50): QueryLog[] {
    return this.queries.slice(0, limit)
  }
}

// Singleton store instance (survives Next.js HMR in dev mode)
const globalForStore = globalThis as unknown as { __agentsenseStore?: Store }
export const store = globalForStore.__agentsenseStore ??= new Store()
