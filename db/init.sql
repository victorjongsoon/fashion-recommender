-- ===============================
-- DROP TABLES (for clean rebuild)
-- ===============================

DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS articles CASCADE;


-- ===============================
-- ARTICLES TABLE (25 columns)
-- ===============================

CREATE TABLE articles (
    article_id TEXT PRIMARY KEY,

    product_code TEXT,
    prod_name TEXT,
    product_type_no INTEGER,
    product_type_name TEXT,
    product_group_name TEXT,

    graphical_appearance_no INTEGER,
    graphical_appearance_name TEXT,

    colour_group_code INTEGER,
    colour_group_name TEXT,

    perceived_colour_value_id INTEGER,
    perceived_colour_value_name TEXT,

    perceived_colour_master_id INTEGER,
    perceived_colour_master_name TEXT,

    department_no INTEGER,
    department_name TEXT,

    index_code TEXT,
    index_name TEXT,

    index_group_no INTEGER,
    index_group_name TEXT,

    section_no INTEGER,
    section_name TEXT,

    garment_group_no INTEGER,
    garment_group_name TEXT,

    detail_desc TEXT
);


-- ===============================
-- CUSTOMERS TABLE (7 columns)
-- ===============================

CREATE TABLE customers (
    customer_id TEXT PRIMARY KEY,
    fn DOUBLE PRECISION,
    active DOUBLE PRECISION,
    club_member_status TEXT,
    fashion_news_frequency TEXT,
    age INTEGER,
    postal_code TEXT
);


-- ===============================
-- TRANSACTIONS TABLE (5 columns)
-- ===============================

CREATE TABLE transactions (
    t_dat DATE NOT NULL,

    customer_id TEXT NOT NULL,
    article_id TEXT NOT NULL,

    price NUMERIC(10,6),

    sales_channel_id INTEGER,

    CONSTRAINT fk_customer
        FOREIGN KEY (customer_id)
        REFERENCES customers(customer_id),

    CONSTRAINT fk_article
        FOREIGN KEY (article_id)
        REFERENCES articles(article_id)
);


-- ===============================
-- INDEXES (CRITICAL for performance)
-- ===============================

CREATE INDEX idx_transactions_customer
    ON transactions(customer_id);

CREATE INDEX idx_transactions_article
    ON transactions(article_id);

CREATE INDEX idx_transactions_date
    ON transactions(t_dat);

CREATE INDEX idx_articles_product_type
    ON articles(product_type_name);

CREATE INDEX idx_articles_index_group
    ON articles(index_group_name);

CREATE INDEX idx_articles_colour
    ON articles(colour_group_name);