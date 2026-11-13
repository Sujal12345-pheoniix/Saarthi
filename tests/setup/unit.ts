// Unit tests run without any infrastructure. Each test sets the env it needs and resets the cache.
(process.env as Record<string, string>).NODE_ENV = "test";
process.env.LOG_LEVEL = "error";
