-- Add DELETE and UPDATE access for authenticated admins
CREATE POLICY "Admins can update slots" ON postalpeek_album_slots
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Admins can delete slots" ON postalpeek_album_slots
  FOR DELETE TO authenticated USING (true);
