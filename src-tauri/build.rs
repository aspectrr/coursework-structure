fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(
            tauri_build::AppManifest::new().commands(&[
                "today_get",
                "calendar_get",
                "admin_list_courses",
                "admin_import",
                "mark_item_complete",
                "course_detail",
                "item_detail",
                "notes_read",
                "notes_write",
                "video_notes_list",
                "video_notes_create",
                "video_notes_update",
                "video_notes_delete",
                "get_courses_dir",
                "pick_courses_dir",
                "preview_import",
                "convert_local_path_to_url",
            ]),
        ),
    )
    .expect("failed to run tauri-build");
}
