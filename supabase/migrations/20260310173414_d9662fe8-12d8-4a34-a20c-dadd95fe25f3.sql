ALTER TABLE activities ADD COLUMN has_motor boolean NOT NULL DEFAULT false;
UPDATE activities SET has_motor = true WHERE id = '559d136b-f589-49b1-b258-3ad0e8eebc9e';