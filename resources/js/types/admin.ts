export type PermissionScope = 'all' | 'department' | 'own';

export type RoleSummary = {
    id: number;
    name: string;
    slug?: string;
    description?: string | null;
    permissions_count?: number;
    users_count?: number;
    is_active?: boolean;
    is_default?: boolean;
    expires_at?: string | null;
};

export type ManagedUser = {
    id: number;
    name: string;
    username: string | null;
    email: string;
    email_verified_at: string | null;
    status: 'active' | 'inactive' | 'pending' | 'declined';
    registration_source: 'admin' | 'self';
    job_title: string | null;
    department: string | null;
    phone: string | null;
    bio: string | null;
    last_login_at: string | null;
    deactivated_at: string | null;
    verification_expires_at: string | null;
    approved_at: string | null;
    declined_at: string | null;
    decline_reason: string | null;
    created_at: string;
    updated_at: string;
    roles: RoleSummary[];
    can: {
        view: boolean;
        update: boolean;
        delete: boolean;
        deactivate: boolean;
        reset_password: boolean;
        assign_roles: boolean;
    };
};

export type PermissionDefinition = {
    id: number;
    permission_module_id: number;
    name: string;
    slug: string;
    action: string;
    description: string | null;
    allowed_scopes: PermissionScope[];
    roles_count?: number;
};

export type PermissionModule = {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    sort_order: number;
    permissions: PermissionDefinition[];
};

export type PaginationLink = {
    url: string | null;
    label: string;
    active: boolean;
};

export type Paginated<T> = {
    data: T[];
    current_page: number;
    last_page: number;
    from: number | null;
    to: number | null;
    total: number;
    links: PaginationLink[];
};
