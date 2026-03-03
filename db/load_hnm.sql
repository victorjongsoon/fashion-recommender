-- Speed up loading
SET synchronous_commit = OFF;

-- ARTICLES
COPY articles
FROM '/data/hnm/articles.csv'
DELIMITER ','
CSV HEADER
QUOTE '"'
NULL '';

-- CUSTOMERS
COPY customers
FROM '/data/hnm/customers.csv'
DELIMITER ','
CSV HEADER
QUOTE '"'
NULL '';

-- TRANSACTIONS
-- COPY transactions
-- FROM '/data/hnm/transactions_train.csv'
-- DELIMITER ','
-- CSV HEADER
-- QUOTE '"'
-- NULL '';

-- ANALYZE;