use coursework_lib::importer::import_all;
use rusqlite::Connection;

fn fresh_db() -> Connection {
    let conn = Connection::open_in_memory().unwrap();
    let sql = std::fs::read_to_string("migrations/001_init.sql").unwrap();
    conn.execute_batch(&sql).unwrap();
    conn
}

#[test]
fn imports_real_course_into_db() {
    let dir = std::path::PathBuf::from(
        "/Users/collinpfeifer/Desktop/learning/courses/mit opencourseware/1.258j-spring-2017",
    );
    if !dir.join("data.json").exists() {
        eprintln!("skipping — course dir not present");
        return;
    }
    let parent = dir.parent().unwrap().to_path_buf();
    let conn = fresh_db();

    let results = import_all(&conn, &parent).expect("import_all ok");
    println!("results: {:?}", results);

    let n_courses: i64 = conn
        .query_row("SELECT COUNT(*) FROM courses", [], |r| r.get(0))
        .unwrap();
    let n_sessions: i64 = conn
        .query_row("SELECT COUNT(*) FROM sessions", [], |r| r.get(0))
        .unwrap();
    let n_items: i64 = conn
        .query_row("SELECT COUNT(*) FROM items", [], |r| r.get(0))
        .unwrap();
    let n_lectures: i64 = conn
        .query_row("SELECT COUNT(*) FROM items WHERE type='lecture'", [], |r| r.get(0))
        .unwrap();
    let n_assignments: i64 = conn
        .query_row("SELECT COUNT(*) FROM items WHERE type='assignment'", [], |r| r.get(0))
        .unwrap();
    println!("courses={n_courses} sessions={n_sessions} items={n_items} lectures={n_lectures} assignments={n_assignments}");

    assert_eq!(n_courses, 1, "expected 1 course");
    assert!(n_items > 0, "expected items, got {n_items}");
}
