import { Bar, BarChart, Cell, Pie, PieChart, XAxis, YAxis } from 'recharts';
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import type { DashboardBreakdownPoint } from '@/lib/dashboard';

const statusChartConfig = {
    completedTasks: {
        label: 'Completed tasks',
        color: 'var(--chart-1)',
    },
    openTasks: {
        label: 'Open tasks',
        color: 'var(--chart-2)',
    },
    activeProjects: {
        label: 'Active projects',
        color: 'var(--chart-3)',
    },
    completedProjects: {
        label: 'Completed projects',
        color: 'var(--chart-4)',
    },
} satisfies ChartConfig;

export function StatusDonutChart({
    data,
}: {
    data: DashboardBreakdownPoint[];
}) {
    const total = data.reduce((sum, item) => sum + item.value, 0);

    return (
        <div className="space-y-4">
            <div className="space-y-1">
                <h2 className="font-semibold">Workspace distribution</h2>
                <p className="text-sm text-muted-foreground">
                    Current tasks and projects by status.
                </p>
            </div>
            <div className="relative">
                <ChartContainer
                    config={statusChartConfig}
                    className="mx-auto aspect-auto h-[250px] w-full max-w-md"
                >
                    <PieChart accessibilityLayer>
                        <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent />}
                        />
                        <Pie
                            data={data}
                            dataKey="value"
                            nameKey="key"
                            innerRadius={62}
                            outerRadius={92}
                            paddingAngle={2}
                            strokeWidth={0}
                        >
                            {data.map((item) => (
                                <Cell key={item.key} fill={item.fill} />
                            ))}
                        </Pie>
                    </PieChart>
                </ChartContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-semibold tabular-nums">
                        {total.toLocaleString()}
                    </span>
                    <span className="text-xs text-muted-foreground">
                        Records
                    </span>
                </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
                {data.map((item) => (
                    <div
                        key={item.key}
                        className="flex items-center justify-between gap-3 text-sm"
                    >
                        <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                            <span
                                className="size-2.5 shrink-0 rounded-sm"
                                style={{ backgroundColor: item.fill }}
                            />
                            <span className="truncate">{item.label}</span>
                        </span>
                        <span className="font-medium tabular-nums">
                            {item.value.toLocaleString()}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function WorkloadBarChart({
    data,
}: {
    data: DashboardBreakdownPoint[];
}) {
    return (
        <div className="space-y-4">
            <div className="space-y-1">
                <h2 className="font-semibold">Workload snapshot</h2>
                <p className="text-sm text-muted-foreground">
                    A quick comparison of open and completed work.
                </p>
            </div>
            <ChartContainer
                config={statusChartConfig}
                className="aspect-auto h-[300px] w-full min-w-0"
            >
                <BarChart
                    accessibilityLayer
                    data={data}
                    layout="vertical"
                    margin={{ top: 8, right: 20, bottom: 8, left: 12 }}
                >
                    <XAxis type="number" hide allowDecimals={false} />
                    <YAxis
                        dataKey="label"
                        type="category"
                        tickLine={false}
                        axisLine={false}
                        width={108}
                        tickMargin={8}
                    />
                    <ChartTooltip
                        cursor={{ fill: 'var(--muted)', opacity: 0.5 }}
                        content={<ChartTooltipContent />}
                    />
                    <Bar dataKey="value" radius={5}>
                        {data.map((item) => (
                            <Cell key={item.key} fill={item.fill} />
                        ))}
                    </Bar>
                </BarChart>
            </ChartContainer>
        </div>
    );
}
