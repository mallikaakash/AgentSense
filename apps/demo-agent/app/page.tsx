"use client"

import { useState, useRef, useEffect } from "react"

interface Step {
  type: "info" | "payment" | "auction" | "content" | "error"
  message: string
  data?: Record<string, unknown>
  timestamp: string
}

interface Message {
  role: "user" | "agent"
  text: string
  steps?: Step[]
  content?: {
    title?: string
    body?: string
    tags?: string[]
  }
  sponsoredContent?: string | null
  mppVoucher?: {
    voucherId: string
    cumulativeAmount: string
    signature: string
  } | null
  payment?: {
    txHash: string
    amount: string
    recipient: string
  }
}

const SUGGESTED_QUERIES = [
  "best recipe for high protein breakfast",
  "quick fitness meal prep ideas",
  "protein smoothie for workout recovery",
]

export default function AgentChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [activeSteps, setActiveSteps] = useState<Step[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, activeSteps])

  async function handleSubmit(query?: string) {
    const q = query || input.trim()
    if (!q || loading) return

    setInput("")
    setLoading(true)
    setActiveSteps([])

    // Add user message
    setMessages((prev) => [...prev, { role: "user", text: q }])

    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      })

      const data = await res.json()

      // Animate steps one by one
      const steps: Step[] = data.steps || []
      for (let i = 0; i < steps.length; i++) {
        setActiveSteps(steps.slice(0, i + 1))
        await new Promise((resolve) => setTimeout(resolve, 400))
      }

      // Add agent message
      const agentMessage: Message = {
        role: "agent",
        text: data.content?.title || "Here's what I found:",
        steps: data.steps,
        content: data.content,
        sponsoredContent: data.sponsoredContent,
        mppVoucher: data.mppVoucher,
        payment: data.payment,
      }

      setMessages((prev) => [...prev, agentMessage])
      setActiveSteps([])
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "agent",
          text: "Sorry, I couldn't complete that query. Make sure the publisher and platform are running.",
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4">
        <h1 className="text-xl font-bold">AgentSense Demo</h1>
        <p className="text-sm text-gray-400">
          Ask a question and watch the agent pay for content on Stellar
        </p>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {messages.length === 0 && (
          <div className="text-center py-16">
            <h2 className="text-2xl font-semibold mb-4 text-gray-300">
              Try asking a question
            </h2>
            <p className="text-gray-500 mb-8">
              The agent will query a publisher blog, pay via Stellar, and show
              you the full payment flow.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {SUGGESTED_QUERIES.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSubmit(q)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors"
                >
                  &ldquo;{q}&rdquo;
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i}>
            {msg.role === "user" ? (
              <div className="flex justify-end">
                <div className="bg-blue-600 text-white px-4 py-3 rounded-2xl rounded-br-md max-w-lg">
                  {msg.text}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Payment flow steps */}
                {msg.steps && (
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2 font-mono text-sm">
                    {msg.steps.map((step, j) => (
                      <StepLine key={j} step={step} />
                    ))}
                  </div>
                )}

                {/* Content */}
                {msg.content && (
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                    {msg.content.title && (
                      <h3 className="text-lg font-semibold mb-3 text-gray-100">
                        {msg.content.title}
                      </h3>
                    )}
                    {msg.content.body && (
                      <div className="text-gray-300 text-sm whitespace-pre-line leading-relaxed">
                        {msg.content.body}
                      </div>
                    )}
                    {msg.content.tags && (
                      <div className="flex gap-2 mt-3 flex-wrap">
                        {msg.content.tags.map((tag) => (
                          <span
                            key={tag}
                            className="bg-gray-800 text-gray-400 text-xs px-2 py-0.5 rounded"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Sponsored content */}
                {msg.sponsoredContent && (
                  <div className="bg-orange-950/30 border border-orange-800/40 rounded-xl p-4">
                    <span className="text-xs text-orange-400 font-semibold uppercase tracking-wider">
                      Sponsored
                    </span>
                    <p className="text-orange-200 text-sm mt-1">
                      {msg.sponsoredContent}
                    </p>
                  </div>
                )}

                {/* Payment receipt */}
                {msg.payment && (
                  <div className="text-xs text-gray-600 flex gap-4 px-1">
                    <span>
                      tx:{" "}
                      {msg.payment.txHash.startsWith("sim_") ? (
                        msg.payment.txHash
                      ) : (
                        <a
                          href={`https://stellar.expert/explorer/testnet/tx/${msg.payment.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:underline"
                        >
                          {msg.payment.txHash}
                        </a>
                      )}
                    </span>
                    <span>paid: ${msg.payment.amount} USDC</span>
                    {msg.payment.recipient && (
                      <span>to: {msg.payment.recipient.slice(0, 8)}...</span>
                    )}
                  </div>
                )}

                {/* MPP Channel Voucher */}
                {msg.mppVoucher && (
                  <div className="bg-green-950/30 border border-green-800/40 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-green-400 font-semibold uppercase tracking-wider">
                        MPP Channel Voucher
                      </span>
                    </div>
                    <div className="space-y-1 text-xs font-mono text-gray-400">
                      <div className="flex gap-2">
                        <span className="text-green-500 shrink-0">voucher:</span>
                        <span className="truncate">{msg.mppVoucher.voucherId}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-green-500 shrink-0">cumulative:</span>
                        <span>
                          {(parseInt(msg.mppVoucher.cumulativeAmount) / 10_000_000).toFixed(7)} USDC
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-green-500 shrink-0">sig:</span>
                        <span className="truncate">{msg.mppVoucher.signature.slice(0, 32)}...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Live steps during loading */}
        {loading && activeSteps.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2 font-mono text-sm">
            {activeSteps.map((step, i) => (
              <StepLine key={i} step={step} />
            ))}
            <div className="flex items-center gap-2 text-gray-500">
              <span className="animate-pulse">...</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-800 px-6 py-4">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSubmit()
          }}
          className="flex gap-3"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about recipes, fitness, nutrition..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            {loading ? "Querying..." : "Send"}
          </button>
        </form>
      </div>
    </div>
  )
}

function StepLine({ step }: { step: Step }) {
  const icons: Record<Step["type"], string> = {
    info: "->",
    payment: "$>",
    auction: ">>",
    content: "OK",
    error: "!!",
  }

  const colors: Record<Step["type"], string> = {
    info: "text-gray-400",
    payment: "text-green-400",
    auction: "text-orange-400",
    content: "text-blue-400",
    error: "text-red-400",
  }

  return (
    <div className={`flex gap-2 ${colors[step.type]}`}>
      <span className="font-bold w-6 shrink-0">{icons[step.type]}</span>
      <span>{step.message}</span>
      {step.data?.txHash ? (
        <span className="text-gray-600 truncate">
          {String(step.data.txHash).startsWith("sim_")
            ? `[${String(step.data.txHash)}]`
            : (
              <a
                href={`https://stellar.expert/explorer/testnet/tx/${String(step.data.txHash)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline"
              >
                [{String(step.data.txHash)}]
              </a>
            )}
        </span>
      ) : null}
    </div>
  )
}
