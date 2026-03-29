import { useEffect, useRef, useState } from 'react'

interface PasswordStrengthMeterProps {
  password: string
  onScoreChange: (score: number) => void
}

const LABELS = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'] as const

function getColor(score: number) {
  if (score <= 1) return 'bg-red-500'
  if (score === 2) return 'bg-orange-500'
  return 'bg-green-500'
}

let initialized = false

async function loadAndCheck(password: string) {
  const [core, common, en] = await Promise.all([
    import('@zxcvbn-ts/core'),
    import('@zxcvbn-ts/language-common'),
    import('@zxcvbn-ts/language-en'),
  ])

  if (!initialized) {
    core.zxcvbnOptions.setOptions({
      graphs: common.adjacencyGraphs,
      dictionary: {
        ...common.dictionary,
        ...en.dictionary,
      },
      translations: en.translations,
    })
    initialized = true
  }

  return core.zxcvbn(password)
}

export function PasswordStrengthMeter({ password, onScoreChange }: PasswordStrengthMeterProps) {
  const [score, setScore] = useState(0)
  const [feedback, setFeedback] = useState('')
  const onScoreChangeRef = useRef(onScoreChange)
  onScoreChangeRef.current = onScoreChange

  useEffect(() => {
    if (!password) {
      setScore(0)
      setFeedback('')
      onScoreChangeRef.current(0)
      return
    }

    let cancelled = false

    loadAndCheck(password).then((result) => {
      if (cancelled) return
      setScore(result.score)
      setFeedback(result.feedback.warning || result.feedback.suggestions[0] || '')
      onScoreChangeRef.current(result.score)
    })

    return () => {
      cancelled = true
    }
  }, [password])

  if (!password) return null

  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-1">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i < score + 1 ? getColor(score) : 'bg-muted'
            }`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{LABELS[score]}</span>
        {feedback && <span className="text-xs text-muted-foreground">{feedback}</span>}
      </div>
    </div>
  )
}
