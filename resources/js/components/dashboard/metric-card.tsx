import {
    CheckCircle2,
    CircleGauge,
    FolderKanban,
    ListTodo,
    TrendingDown,
    TrendingUp,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DashboardMetric } from '@/lib/dashboard';
import { cn } from '@/lib/utils';

const metricIcons = {
    tasks: ListTodo,
    completed: CheckCircle2,
    projects: FolderKanban,
    completion: CircleGauge,
};

export function MetricCard({ metric }: { metric: DashboardMetric }) {
    const Icon = metricIcons[metric.key];
    const TrendIcon = metric.trend < 0 ? TrendingDown : TrendingUp;

    return (
        <Card className="gap-4 overflow-hidden py-5">
            <CardHeader className="flex flex-row items-start justify-between gap-4 px-5">
                <div className="flex min-w-0 items-center gap-2">
                    <Icon
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                    />
                    <CardTitle className="truncate text-sm font-medium text-muted-foreground">
                        {metric.title}
                    </CardTitle>
                </div>
                <Badge
                    variant="outline"
                    className={cn(
                        'gap-1 font-normal tabular-nums',
                        metric.trend < 0 && 'text-destructive',
                    )}
                >
                    <TrendIcon aria-hidden="true" />
                    {formatTrend(metric.trend)}
                </Badge>
            </CardHeader>
            <CardContent className="space-y-2 px-5">
                <div className="text-2xl font-semibold tracking-tight tabular-nums">
                    {metric.value}
                </div>
                <p className="text-sm font-medium">{metric.trendLabel}</p>
                <p className="text-xs text-muted-foreground">
                    {metric.description}
                </p>
            </CardContent>
        </Card>
    );
}

function formatTrend(trend: number): string {
    if (trend > 0) {
        return `+${trend}%`;
    }

    return `${trend}%`;
}
