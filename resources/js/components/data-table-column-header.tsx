import type { Column, RowData } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import type { DataTableFeatures } from '@/components/data-table-features';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type DataTableColumnHeaderProps<TData extends RowData> = {
    column: Column<DataTableFeatures, TData, unknown>;
    title: string;
    className?: string;
};

export function DataTableColumnHeader<TData extends RowData>({
    column,
    title,
    className,
}: DataTableColumnHeaderProps<TData>) {
    if (!column.getCanSort()) {
        return <span className={className}>{title}</span>;
    }

    const sortDirection = column.getIsSorted();

    return (
        <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn('-ml-3 h-8 data-[state=open]:bg-accent', className)}
            onClick={() => column.toggleSorting(sortDirection === 'asc')}
        >
            <span>{title}</span>
            {sortDirection === 'desc' ? (
                <ArrowDown aria-hidden="true" />
            ) : sortDirection === 'asc' ? (
                <ArrowUp aria-hidden="true" />
            ) : (
                <ArrowUpDown aria-hidden="true" />
            )}
            <span className="sr-only">
                {sortDirection
                    ? `Currently sorted ${sortDirection}. Change sorting.`
                    : 'Sort column'}
            </span>
        </Button>
    );
}
