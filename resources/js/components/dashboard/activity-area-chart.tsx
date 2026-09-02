import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { DashboardActivityPoint, DashboardRange } from '@/lib/dashboard';

const activityChartConfig = {
    tasks: {
        label: 'Tasks',
        color: 'var(--chart-1)',
    },
    projects: {
        label: 'Projects',
        color: 'var(--chart-2)',
    },
} satisfies ChartConfig;

type ActivityAreaChartProps = {
    data: DashboardActivityPoint[];
    range: DashboardRange;
    onRangeChange: (range: DashboardRange) => void;
};

export function ActivityAreaChart({
    data,
    range,
    onRangeChange,
}: ActivityAreaChartProps) {
    return (
        <div className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                    <h2 className="font-semibold">Workspace activity</h2>
                    <p className="text-sm text-muted-foreground">
                        New tasks and projects over the selected period.
                    </p>
                </div>
                <ToggleGroup
                    type="single"
                    variant="outline"
                    size="sm"
                    value={String(range)}
                    onValueChange={(value) => {
                        const nextRange = Number(value);

                        if (
                            nextRange === 7 ||
                            nextRange === 30 ||
                            nextRange === 90
                        ) {
                            onRangeChange(nextRange);
                        }
                    }}
                    aria-label="Activity date range"
                    className="self-start"
                >
                    <ToggleGroupItem value="90" aria-label="Last 90 days">
                        3 months
                    </ToggleGroupItem>
                    <ToggleGroupItem value="30" aria-label="Last 30 days">
                        30 days
                    </ToggleGroupItem>
                    <ToggleGroupItem value="7" aria-label="Last 7 days">
                        7 days
                    </ToggleGroupItem>
                </ToggleGroup>
            </div>

            <ChartContainer
                config={activityChartConfig}
                className="aspect-auto h-[280px] w-full min-w-0 sm:h-[340px]"
            >
                <AreaChart
                    accessibilityLayer
                    data={data}
                    margin={{ top: 12, right: 12, left: -24, bottom: 0 }}
                >
                    <defs>
                        <linearGradient
                            id="dashboard-fill-tasks"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                        >
                            <stop
                                offset="5%"
                                stopColor="var(--color-tasks)"
                                stopOpacity={0.45}
                            />
                            <stop
                                offset="95%"
                                stopColor="var(--color-tasks)"
                                stopOpacity={0.04}
                            />
                        </linearGradient>
                        <linearGradient
                            id="dashboard-fill-projects"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                        >
                            <stop
                                offset="5%"
                                stopColor="var(--color-projects)"
                                stopOpacity={0.35}
                            />
                            <stop
                                offset="95%"
                                stopColor="var(--color-projects)"
                                stopOpacity={0.03}
                            />
                        </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={10}
                        minTickGap={28}
                    />
                    <YAxis
                        allowDecimals={false}
                        tickLine={false}
                        axisLine={false}
                    />
                    <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent />}
                    />
                    <Area
                        dataKey="projects"
                        type="monotone"
                        fill="url(#dashboard-fill-projects)"
                        stroke="var(--color-projects)"
                        strokeWidth={2}
                    />
                    <Area
                        dataKey="tasks"
                        type="monotone"
                        fill="url(#dashboard-fill-tasks)"
                        stroke="var(--color-tasks)"
                        strokeWidth={2}
                    />
                </AreaChart>
            </ChartContainer>
        </div>
    );
}
