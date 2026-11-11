// D1-compatible adapter for local development and integration tests only.
import {DatabaseSync} from 'node:sqlite';
export function openDatabase(filename=':memory:'){
  const sqlite=new DatabaseSync(filename);sqlite.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  const database={
    sqlite,
    prepare(sql){return {bind(...values){const statement=sqlite.prepare(sql);return {
      async first(){return statement.get(...values)??null},
      async all(){return {results:statement.all(...values)}},
      async run(){const result=statement.run(...values);return {success:true,meta:{changes:Number(result.changes)}}}
    }}}},
    async batch(statements){sqlite.exec('BEGIN IMMEDIATE');try{const result=[];for(const statement of statements)result.push(await statement.run());sqlite.exec('COMMIT');return result}catch(error){sqlite.exec('ROLLBACK');throw error}},
    close(){sqlite.close()}
  };return database;
}
