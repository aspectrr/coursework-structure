mod commands;
mod db;
mod error;
mod importer;
mod import_runner;
mod models;
mod paths;
mod plan;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
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
