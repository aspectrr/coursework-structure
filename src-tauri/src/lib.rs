mod commands;
mod db;
mod error;
pub mod importer;
pub mod import_runner;
pub mod models;
pub mod paths;
pub mod plan;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Serve the frontend over http://localhost in release builds: YouTube
    // embeds require a valid HTTP Referer origin, and `tauri://localhost` on
    // macOS can never send one → YouTube error 153 (player config error).
    // Fixed port so capabilities/default.json can allowlist the origin at
    // build time; runtime capability ACL didn't apply reliably.
    const PORT: u16 = 41794;

    tauri::Builder::default()
        .plugin(tauri_plugin_localhost::Builder::new(PORT).build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            #[cfg(dev)]
            let url = tauri::WebviewUrl::App(std::path::PathBuf::from("/"));

            #[cfg(not(dev))]
            let url = tauri::WebviewUrl::External(
                format!("http://localhost:{}", PORT).parse().unwrap(),
            );

            tauri::WebviewWindowBuilder::new(app, "main".to_string(), url)
                .title("Coursework")
                .inner_size(1280.0, 800.0)
                .min_inner_size(900.0, 600.0)
                .resizable(true)
                .build()?;

            let db_handle = db::init(app.handle()).expect("db init");
            app.manage(db_handle);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::today_get,
            commands::calendar_get,
            commands::admin_list_courses,
            commands::admin_import,
            commands::mark_item_complete,
            commands::course_detail,
            commands::item_detail,
            commands::notes_read,
            commands::notes_write,
            commands::video_notes_list,
            commands::video_notes_create,
            commands::video_notes_update,
            commands::video_notes_delete,
            commands::get_courses_dir,
            commands::pick_courses_dir,
            commands::preview_import,
            commands::convert_local_path_to_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
