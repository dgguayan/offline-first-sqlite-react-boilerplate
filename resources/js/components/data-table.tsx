import { useTable } from '@tanstack/react-table';
import type { RowData } from '@tanstack/react-table';
import {
    ChevronFirst,
    ChevronLast,
    ChevronLeft,
    ChevronRight,
    Columns3,
    Search,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { dataTableFeatures } from '@/components/data-table-features';
import type { DataTableColumnDef } from '@/components/data-table-features';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

type DataTableProps<TData extends RowData> = {
    columns: ReadonlyArray<DataTableColumnDef<TData>>;
    data: readonly TData[];
    emptyMessage?: string;
    emptyState?: ReactNode;
    initialPageSize?: number;
    initialSorting?: Array<{ id: string; desc: boolean }>;
    processingMode?: 'client' | 'server';
    searchPlaceholder?: string;
    showColumnVisibility?: boolean;
    showPagination?: boolean;
    showSearch?: boolean;
    showSelectionSummary?: boolean;
    tableContainerClassName?: string;
    toolbarStart?: ReactNode;
};

export function DataTable<TData extends RowData>({
    columns,
    data,
    emptyMessage = 'No results found.',
    emptyState,
    initialPageSize = 10,
    initialSorting = [],
    processingMode = 'client',
    searchPlaceholder = 'Search records...',
    showColumnVisibility = true,
    showPagination = true,
    showSearch = true,
    showSelectionSummary = true,
    tableContainerClassName,
    toolbarStart,
}: DataTableProps<TData>) {
    const table = useTable({
        features: dataTableFeatures,
        columns,
        data,
        getRowId: (row, index) =>
            typeof row === 'object' &&
            row !== null &&
            'id' in row &&
            (typeof row.id === 'string' || typeof row.id === 'number')
                ? String(row.id)
                : String(index),
        globalFilterFn: 'includesString',
        manualFiltering: processingMode === 'server',
        manualPagination: processingMode === 'server',
        manualSorting: processingMode === 'server',
        initialState: {
            pagination: {
                pageIndex: 0,
                pageSize: initialPageSize,
            },
            sorting: initialSorting,
        },
    });

    const filteredRows = table.getFilteredRowModel().rows;
    const selectedRows = table.getFilteredSelectedRowModel().rows;
    const visibleColumnCount = table.getVisibleLeafColumns().length;
    const displayedRows = showPagination
        ? table.getRowModel().rows
        : table.getPrePaginatedRowModel().rows;
    const showToolbar =
        Boolean(toolbarStart) || showSearch || showColumnVisibility;

    return (
        <div className="space-y-4">
            {showToolbar && (
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
                        {toolbarStart}
                        {showSearch && (
                            <div className="relative w-full sm:max-w-xs">
                                <Search
                                    aria-hidden="true"
                                    className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                                />
                                <Input
                                    value={String(
                                        table.state.globalFilter ?? '',
                                    )}
                                    onChange={(event) =>
                                        table.setGlobalFilter(
                                            event.target.value,
                                        )
                                    }
                                    placeholder={searchPlaceholder}
                                    aria-label={searchPlaceholder}
                                    className="pl-9"
                                />
                            </div>
                        )}
                    </div>

                    {showColumnVisibility && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                >
                                    <Columns3 />
                                    Columns
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuLabel>
                                    Visible columns
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {table
                                    .getAllLeafColumns()
                                    .filter((column) => column.getCanHide())
                                    .map((column) => (
                                        <DropdownMenuCheckboxItem
                                            key={column.id}
                                            checked={column.getIsVisible()}
                                            onCheckedChange={(checked) =>
                                                column.toggleVisibility(
                                                    Boolean(checked),
                                                )
                                            }
                                        >
                                            {humanizeColumnId(column.id)}
                                        </DropdownMenuCheckboxItem>
                                    ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
            )}

            <div
                className={cn(
                    'overflow-hidden rounded-lg border',
                    tableContainerClassName,
                )}
            >
                <Table>
                    <TableHeader className="bg-muted/40">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <TableHead
                                        key={header.id}
                                        colSpan={header.colSpan}
                                    >
                                        {header.isPlaceholder ? null : (
                                            <table.FlexRender header={header} />
                                        )}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {displayedRows.length > 0 ? (
                            displayedRows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={
                                        row.getIsSelected()
                                            ? 'selected'
                                            : undefined
                                    }
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            <table.FlexRender cell={cell} />
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={visibleColumnCount}
                                    className="h-28 text-center text-muted-foreground"
                                >
                                    {emptyState ?? emptyMessage}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {(showSelectionSummary || showPagination) && (
                <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                    {showSelectionSummary ? (
                        <div>
                            {selectedRows.length} of {filteredRows.length}{' '}
                            row(s) selected.
                        </div>
                    ) : (
                        <div />
                    )}
                    {showPagination && (
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-2">
                                <span>Rows per page</span>
                                <Select
                                    value={String(
                                        table.state.pagination.pageSize,
                                    )}
                                    onValueChange={(value) =>
                                        table.setPageSize(Number(value))
                                    }
                                >
                                    <SelectTrigger
                                        size="sm"
                                        className="w-18"
                                        aria-label="Rows per page"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {[5, 10, 20].map((pageSize) => (
                                            <SelectItem
                                                key={pageSize}
                                                value={String(pageSize)}
                                            >
                                                {pageSize}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="min-w-24 text-center text-foreground">
                                Page {table.state.pagination.pageIndex + 1} of{' '}
                                {Math.max(table.getPageCount(), 1)}
                            </div>
                            <div className="flex items-center gap-1">
                                <PaginationButton
                                    label="First page"
                                    disabled={!table.getCanPreviousPage()}
                                    onClick={() => table.firstPage()}
                                >
                                    <ChevronFirst />
                                </PaginationButton>
                                <PaginationButton
                                    label="Previous page"
                                    disabled={!table.getCanPreviousPage()}
                                    onClick={() => table.previousPage()}
                                >
                                    <ChevronLeft />
                                </PaginationButton>
                                <PaginationButton
                                    label="Next page"
                                    disabled={!table.getCanNextPage()}
                                    onClick={() => table.nextPage()}
                                >
                                    <ChevronRight />
                                </PaginationButton>
                                <PaginationButton
                                    label="Last page"
                                    disabled={!table.getCanLastPage()}
                                    onClick={() => table.lastPage()}
                                >
                                    <ChevronLast />
                                </PaginationButton>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function PaginationButton({
    label,
    ...props
}: React.ComponentProps<typeof Button> & { label: string }) {
    return (
        <Button type="button" variant="outline" size="icon" {...props}>
            {props.children}
            <span className="sr-only">{label}</span>
        </Button>
    );
}

function humanizeColumnId(columnId: string): string {
    return columnId
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replaceAll('_', ' ')
        .replace(/^./, (character) => character.toUpperCase());
}
