CREATE TABLE books (
 id TEXT NOT NULL, owner TEXT NOT NULL,
 title TEXT NOT NULL, author TEXT NOT NULL, category TEXT NOT NULL,
 isbn TEXT NOT NULL, shelf TEXT NOT NULL, color TEXT NOT NULL,
 version INTEGER NOT NULL DEFAULT 1, archived_at TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 PRIMARY KEY(owner,id), UNIQUE(owner,isbn)
);
--> statement-breakpoint
CREATE TABLE readers (
 id TEXT NOT NULL, owner TEXT NOT NULL,
 name TEXT NOT NULL, card TEXT NOT NULL, email TEXT NOT NULL DEFAULT '',
 version INTEGER NOT NULL DEFAULT 1, archived_at TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 PRIMARY KEY(owner,id), UNIQUE(owner,card)
);
--> statement-breakpoint
CREATE TABLE loans (
 id TEXT NOT NULL, owner TEXT NOT NULL,
 book TEXT NOT NULL, reader TEXT NOT NULL, date TEXT NOT NULL, due TEXT NOT NULL,
 returned TEXT, renewals INTEGER NOT NULL DEFAULT 0 CHECK(renewals IN (0,1)),
 version INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 PRIMARY KEY(owner,id),
 FOREIGN KEY(owner,book) REFERENCES books(owner,id),
 FOREIGN KEY(owner,reader) REFERENCES readers(owner,id)
);
--> statement-breakpoint
CREATE UNIQUE INDEX one_active_loan ON loans(owner,book) WHERE returned IS NULL;
--> statement-breakpoint
CREATE INDEX loans_owner ON loans(owner,created_at);
--> statement-breakpoint
CREATE INDEX loans_reader ON loans(owner,reader,returned);
--> statement-breakpoint
CREATE TABLE audit (
 seq INTEGER PRIMARY KEY AUTOINCREMENT, owner TEXT NOT NULL,
 action TEXT NOT NULL, entity TEXT NOT NULL, entity_id TEXT NOT NULL,
 at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE INDEX audit_owner ON audit(owner,seq);
--> statement-breakpoint
CREATE TABLE imports (owner TEXT PRIMARY KEY NOT NULL, token TEXT NOT NULL);
--> statement-breakpoint
CREATE TRIGGER books_created AFTER INSERT ON books BEGIN
 INSERT INTO audit(owner,action,entity,entity_id) VALUES(NEW.owner,'create','book',NEW.id);
END;
--> statement-breakpoint
CREATE TRIGGER books_updated AFTER UPDATE ON books BEGIN
 INSERT INTO audit(owner,action,entity,entity_id) VALUES(NEW.owner,CASE WHEN NEW.archived_at IS NOT OLD.archived_at THEN CASE WHEN NEW.archived_at IS NULL THEN 'restore' ELSE 'archive' END ELSE 'update' END,'book',NEW.id);
END;
--> statement-breakpoint
CREATE TRIGGER readers_created AFTER INSERT ON readers BEGIN
 INSERT INTO audit(owner,action,entity,entity_id) VALUES(NEW.owner,'create','reader',NEW.id);
END;
--> statement-breakpoint
CREATE TRIGGER readers_updated AFTER UPDATE ON readers BEGIN
 INSERT INTO audit(owner,action,entity,entity_id) VALUES(NEW.owner,CASE WHEN NEW.archived_at IS NOT OLD.archived_at THEN CASE WHEN NEW.archived_at IS NULL THEN 'restore' ELSE 'archive' END ELSE 'update' END,'reader',NEW.id);
END;
--> statement-breakpoint
CREATE TRIGGER loans_created AFTER INSERT ON loans BEGIN
 INSERT INTO audit(owner,action,entity,entity_id) VALUES(NEW.owner,'checkout','loan',NEW.id);
END;
--> statement-breakpoint
CREATE TRIGGER loans_updated AFTER UPDATE ON loans BEGIN
 INSERT INTO audit(owner,action,entity,entity_id) VALUES(NEW.owner,CASE WHEN NEW.returned IS NOT OLD.returned THEN 'return' ELSE 'renew' END,'loan',NEW.id);
END;
