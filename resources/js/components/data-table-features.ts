import {
    columnFilteringFeature,
    columnVisibilityFeature,
    createFilteredRowModel,
    createPaginatedRowModel,
    createSortedRowModel,
    filterFn_includesString,
    globalFilteringFeature,
    rowPaginationFeature,
    rowSelectionFeature,
    rowSortingFeature,
    sortFn_alphanumeric,
    sortFn_datetime,
    sortFn_text,
    tableFeatures,
} from '@tanstack/react-table';
import type { ColumnDef, RowData } from '@tanstack/react-table';

export const dataTableFeatures = tableFeatures({
    columnFilteringFeature,
    columnVisibilityFeature,
    globalFilteringFeature,
    rowPaginationFeature,
    rowSelectionFeature,
    rowSortingFeature,
    filteredRowModel: createFilteredRowModel(),
    paginatedRowModel: createPaginatedRowModel(),
    sortedRowModel: createSortedRowModel(),
    filterFns: {
        includesString: filterFn_includesString,
    },
    sortFns: {
        alphanumeric: sortFn_alphanumeric,
        datetime: sortFn_datetime,
        text: sortFn_text,
    },
});

export type DataTableFeatures = typeof dataTableFeatures;

export type DataTableColumnDef<
    TData extends RowData,
    TValue = unknown,
> = ColumnDef<DataTableFeatures, TData, TValue>;
