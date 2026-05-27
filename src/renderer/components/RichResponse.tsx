import { BarChart3, TrendingUp, Calendar, DollarSign, Users } from 'lucide-react'

interface RichContent {
  type: 'chart' | 'image' | 'timeline' | 'stats'
  data: any
}

interface RichResponseProps {
  content: RichContent
}

export function RichResponse({ content }: RichResponseProps) {
  if (content.type === 'chart') {
    return <ChartView data={content.data} />
  }
  if (content.type === 'image') {
    return <ImageView data={content.data} />
  }
  if (content.type === 'timeline') {
    return <TimelineView data={content.data} />
  }
  if (content.type === 'stats') {
    return <StatsView data={content.data} />
  }
  return null
}

function ChartView({ data }: { data: any }) {
  const { values, labels, title } = data
  const maxVal = Math.max(...values)

  return (
    <div className="mt-3 p-4 rounded-lg bg-zinc-800/50 border border-zinc-800">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="w-4 h-4 text-zinc-400" />
        <span className="text-sm font-medium text-zinc-300">{title || 'Chart'}</span>
      </div>
      <div className="flex items-end gap-2 h-32">
        {values.map((val: number, i: number) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full bg-gradient-to-t from-blue-500 to-purple-500 rounded-t transition-all hover:from-blue-400 hover:to-purple-400"
              style={{ height: `${(val / maxVal) * 100}%` }}
            />
            <span className="text-[10px] text-zinc-500">{labels?.[i] || ''}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ImageView({ data }: { data: any }) {
  const { url, alt, caption } = data
  return (
    <div className="mt-3 rounded-lg overflow-hidden bg-zinc-800/50 border border-zinc-800">
      <img src={url} alt={alt || ''} className="w-full max-h-64 object-cover" />
      {caption && <p className="px-3 py-2 text-xs text-zinc-500">{caption}</p>}
    </div>
  )
}

function TimelineView({ data }: { data: any }) {
  const { events, title } = data
  return (
    <div className="mt-3 p-4 rounded-lg bg-zinc-800/50 border border-zinc-800">
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="w-4 h-4 text-zinc-400" />
        <span className="text-sm font-medium text-zinc-300">{title || 'Timeline'}</span>
      </div>
      <div className="space-y-3">
        {events.map((event: any, i: number) => (
          <div key={i} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              {i < events.length - 1 && <div className="w-px h-8 bg-zinc-700 mt-1" />}
            </div>
            <div>
              <div className="text-sm text-zinc-200">{event.title}</div>
              <div className="text-xs text-zinc-500">{event.description}</div>
              {event.time && <div className="text-[10px] text-zinc-600 mt-0.5">{event.time}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function StatsView({ data }: { data: any }) {
  const { stats, title } = data
  const iconMap: Record<string, any> = {
    revenue: DollarSign,
    users: Users,
    growth: TrendingUp,
    default: BarChart3,
  }

  return (
    <div className="mt-3">
      {title && (
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-zinc-400" />
          <span className="text-sm font-medium text-zinc-300">{title}</span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        {stats.map((stat: any, i: number) => {
          const Icon = iconMap[stat.icon] || iconMap.default
          return (
            <div key={i} className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-800">
              <div className="flex items-center gap-2 mb-1">
                <Icon className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-xs text-zinc-500">{stat.label}</span>
              </div>
              <div className="text-lg font-bold text-zinc-100">{stat.value}</div>
              {stat.change && (
                <div className={`text-xs ${stat.change > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {stat.change > 0 ? '↑' : '↓'} {Math.abs(stat.change)}%
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
