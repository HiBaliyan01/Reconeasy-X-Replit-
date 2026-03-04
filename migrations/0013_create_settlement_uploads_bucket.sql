-- Ensure storage bucket exists for settlement file uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('settlement-uploads', 'settlement-uploads', false)
ON CONFLICT (id) DO NOTHING;
