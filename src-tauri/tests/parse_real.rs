use coursework_lib::importer::parse_course;

#[test]
fn parses_real_course() {
    let dir = std::path::PathBuf::from(
        "/Users/collinpfeifer/Desktop/learning/courses/mit opencourseware/1.258j-spring-2017",
    );
    if !dir.join("data.json").exists() {
        eprintln!("skipping — course dir not present");
        return;
    }
    let parent = dir.parent().unwrap();
    let parsed = parse_course(&dir, parent).expect("parse ok");
    println!("slug={}", parsed.course.slug);
    println!("image_url={:?}", parsed.course.image_url);
    println!("sessions={}", parsed.sessions.len());
    println!("lectures={}", parsed.lectures.len());
    println!("assignments={}", parsed.assignments.len());
    println!("other={}", parsed.other_items.len());
    for l in &parsed.lectures {
        println!(
            "  LEC n={:?} key={:?} yt={:?} pdf={:?}",
            l.session_number,
            l.folder_name,
            l.resource.youtube_key,
            l.resolved.pdf_url,
        );
    }
    assert!(parsed.lectures.len() >= 15, "expected >=15 lectures");
}
