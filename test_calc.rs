/// Calculate the area of a rectangle.
fn calculate_area(width: f64, height: f64) -> f64 {
    width * height
}

/// Calculate the perimeter of a rectangle.
fn calculate_perimeter(width: f64, height: f64) -> f64 {
    2.0 * (width + height)
}

fn main() {
    let w = 5.0;
    let h = 3.0;
    println!("Area: {}", calculate_area(w, h));
    println!("Perimeter: {}", calculate_perimeter(w, h));
}
