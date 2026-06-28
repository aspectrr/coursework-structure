use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("db: {0}")]
    Db(#[from] rusqlite::Error),
    #[error("io: {0}")]
    Io(#[from] std::io::Error),
    #[error("json: {0}")]
    Json(#[from] serde_json::Error),
    #[error("not found: {0}")]
    NotFound(String),
    #[error("bad request: {0}")]
    BadRequest(String),
    #[error("{0}")]
    Other(String),
}

impl From<&str> for Error {
    fn from(s: &str) -> Self { Error::Other(s.to_string()) }
}
impl From<String> for Error {
    fn from(s: String) -> Self { Error::Other(s) }
}
impl From<anyhow::Error> for Error {
    fn from(e: anyhow::Error) -> Self { Error::Other(e.to_string()) }
}

impl Serialize for Error {
    fn serialize<S: serde::Serializer>(&self, s: S) -> std::result::Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

pub type Result<T> = std::result::Result<T, Error>;
pub type CmdResult<T> = std::result::Result<T, String>;

pub fn to_cmd<T, E: std::fmt::Display>(r: std::result::Result<T, E>) -> CmdResult<T> {
    r.map_err(|e| e.to_string())
}
