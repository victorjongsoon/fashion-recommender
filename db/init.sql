CREATE TABLE items (
    item_id TEXT PRIMARY KEY,
    image_path TEXT NOT NULL,
    category_l1 TEXT NOT NULL,
    category_l2 TEXT NOT NULL,
    category_l3 TEXT NOT NULL,
    description TEXT
);