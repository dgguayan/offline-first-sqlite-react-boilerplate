import * as React from 'react';
import {
    ResponsiveContainer,
    Tooltip as RechartsTooltip,
    type TooltipContentProps,
} from 'recharts';
import { cn } from '@/lib/utils';

export type ChartConfig = Record<
    string,
    {
        label?: React.ReactNode;
        color?: string;
    }
>;

type ChartContextValue = {
    config: ChartConfig;
};

const ChartContext = React.createContext<ChartContextValue | null>(null);

function useChart(): ChartContextValue {
    const context = React.useContext(ChartContext);

    if (!context) {
        throw new Error('useChart must be used within a ChartContainer.');
    }

    return context;
}

function ChartContainer({
    id,
    className,
    children,
    config,
    ...props
}: React.ComponentProps<'div'> & {
    config: ChartConfig;
    children: React.ComponentProps<typeof ResponsiveContainer>['children'];
}) {
    const uniqueId = React.useId();
    const chartId = `chart-${id ?? uniqueId.replaceAll(':', '')}`;

    return (
        <ChartContext.Provider value={{ config }}>
            <div
                data-slot="chart"
                data-chart={chartId}
                className={cn(
                    "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-layer]:outline-hidden [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border",
                    className,
                )}
                {...props}
            >
                <ChartStyle id={chartId} config={config} />
                <ResponsiveContainer>{children}</ResponsiveContainer>
            </div>
        </ChartContext.Provider>
    );
}

function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
    const colorConfig = Object.entries(config).filter(
        ([, itemConfig]) => itemConfig.color,
    );

    if (colorConfig.length === 0) {
        return null;
    }

    const declarations = colorConfig
        .map(
            ([key, itemConfig]) =>
                `  --color-${key}: ${itemConfig.color as string};`,
        )
        .join('\n');

    return (
        <style
            dangerouslySetInnerHTML={{
                __html: `[data-chart="${id}"] {\n${declarations}\n}`,
            }}
        />
    );
}

const ChartTooltip = RechartsTooltip;

function ChartTooltipContent({
    active,
    payload,
    label,
    className,
}: Partial<TooltipContentProps> & { className?: string }) {
    const { config } = useChart();

    if (!active || !payload?.length) {
        return null;
    }

    return (
        <div
            className={cn(
                'grid min-w-32 gap-1.5 rounded-lg border bg-background px-3 py-2 text-xs shadow-xl',
                className,
            )}
        >
            {label !== undefined && (
                <div className="font-medium text-foreground">{label}</div>
            )}
            <div className="grid gap-1.5">
                {payload.map((item, index) => {
                    const payloadKey =
                        item.payload &&
                        typeof item.payload === 'object' &&
                        'key' in item.payload &&
                        typeof item.payload.key === 'string'
                            ? item.payload.key
                            : null;
                    const configKey = String(
                        payloadKey ?? item.dataKey ?? item.name ?? index,
                    );
                    const itemConfig = config[configKey];

                    return (
                        <div
                            key={`${configKey}-${index}`}
                            className="flex items-center justify-between gap-4"
                        >
                            <span className="flex items-center gap-2 text-muted-foreground">
                                <span
                                    className="size-2.5 shrink-0 rounded-[2px]"
                                    style={{
                                        backgroundColor:
                                            item.color ??
                                            `var(--color-${configKey})`,
                                    }}
                                />
                                {itemConfig?.label ?? item.name ?? configKey}
                            </span>
                            <span className="font-mono font-medium tabular-nums text-foreground">
                                {typeof item.value === 'number'
                                    ? item.value.toLocaleString()
                                    : item.value}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export { ChartContainer, ChartTooltip, ChartTooltipContent };
