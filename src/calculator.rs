/// Calculate the area of a rectangle.
pub fn calculate_area(width: f64, height: f64) -> f64 {
    width * height
}

/// Calculate the perimeter of a rectangle.
pub fn calculate_perimeter(width: f64, height: f64) -> f64 {
    2.0 * (width + height)
}

/// Calculate the area of a circle.
pub fn calculate_circle_area(radius: f64) -> f64 {
    std::f64::consts::PI * radius * radius
}
