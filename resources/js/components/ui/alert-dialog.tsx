import type { ComponentProps } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const AlertDialog = Dialog;
const AlertDialogTrigger = DialogTrigger;
const AlertDialogHeader = DialogHeader;
const AlertDialogFooter = DialogFooter;
const AlertDialogTitle = DialogTitle;
const AlertDialogDescription = DialogDescription;

function AlertDialogContent({
    className,
    ...props
}: ComponentProps<typeof DialogContent>) {
    return (
        <DialogContent
            role="alertdialog"
            className={cn('sm:max-w-md', className)}
            {...props}
        />
    );
}

function AlertDialogAction(props: ComponentProps<typeof Button>) {
    return <Button {...props} />;
}

function AlertDialogCancel({
    children = 'Cancel',
    ...props
}: ComponentProps<typeof Button>) {
    return (
        <DialogClose asChild>
            <Button variant="outline" {...props}>
                {children}
            </Button>
        </DialogClose>
    );
}

export {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
};
