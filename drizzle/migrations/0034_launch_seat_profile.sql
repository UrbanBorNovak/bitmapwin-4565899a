ALTER TABLE public.launch_seats ADD COLUMN IF NOT EXISTS x_handle text, ADD COLUMN IF NOT EXISTS status_note text;
ALTER TABLE public.launch_seats ADD CONSTRAINT launch_seats_x_handle_chk CHECK (x_handle IS NULL OR x_handle ~ '^[A-Za-z0-9_]{1,15}$');
ALTER TABLE public.launch_seats ADD CONSTRAINT launch_seats_status_chk CHECK (status_note IS NULL OR char_length(status_note) <= 40);