import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

type StatusAction = 'send' | 'pay' | 'cancel'

const ACTION_CONFIG: Record<StatusAction, { title: string; description: string; label: string }> = {
  send: {
    title: 'Mark as Sent',
    description: 'This will mark the invoice as sent. You can still cancel it afterwards.',
    label: 'Mark as Sent',
  },
  pay: {
    title: 'Mark as Paid',
    description: 'This will mark the invoice as paid. This action cannot be undone.',
    label: 'Mark as Paid',
  },
  cancel: {
    title: 'Cancel Invoice',
    description: 'This will cancel the invoice. This action cannot be undone.',
    label: 'Cancel Invoice',
  },
}

interface StatusChangeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  action: StatusAction
  onConfirm: () => void
  isPending: boolean
}

export function StatusChangeDialog({
  open,
  onOpenChange,
  action,
  onConfirm,
  isPending,
}: StatusChangeDialogProps) {
  const config = ACTION_CONFIG[action]

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{config.title}</AlertDialogTitle>
          <AlertDialogDescription>{config.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isPending}>
            {isPending ? 'Updating...' : config.label}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
