use std::{env, fs, path::PathBuf};

fn main() {
    let manifest_dir = PathBuf::from(env::var_os("CARGO_MANIFEST_DIR").unwrap());
    let out_dir = PathBuf::from(env::var_os("OUT_DIR").unwrap());
    let source_icon = manifest_dir.join("icons").join("icon.ico");
    let build_icon = out_dir.join("desktop-pet.ico");

    fs::copy(&source_icon, &build_icon).expect("failed to stage the Windows icon");

    let windows = tauri_build::WindowsAttributes::new().window_icon_path(build_icon);
    let attributes = tauri_build::Attributes::new().windows_attributes(windows);
    tauri_build::try_build(attributes).expect("failed to run Tauri build script");
}
