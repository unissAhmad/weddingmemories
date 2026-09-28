import { Toaster as Sonner } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = (props: ToasterProps) => (
  <Sonner
    position="top-center"
    toastOptions={{
      classNames: {
        toast: 'group !bg-card !text-card-foreground !border-border !shadow-lg !rounded-xl !font-sans',
        description: '!text-muted-foreground',
        actionButton: '!bg-primary !text-primary-foreground',
      },
    }}
    {...props}
  />
);

export { Toaster };
