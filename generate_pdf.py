import markdown
from weasyprint import HTML, CSS
from weasyprint.text.fonts import FontConfiguration
import os

def markdown_to_pdf(markdown_file, output_pdf):
    """Convert markdown file to PDF with professional styling"""
    
    # Read markdown content
    with open(markdown_file, 'r', encoding='utf-8') as f:
        markdown_content = f.read()
    
    # Convert markdown to HTML
    html_content = markdown.markdown(markdown_content, extensions=['tables', 'fenced_code'])
    
    # CSS styling for professional PDF
    css_content = """
    @page {
        size: A4;
        margin: 2cm;
        @top-center {
            content: "Road Anomaly Detection System - Project Analysis";
            font-size: 10pt;
            color: #666;
        }
        @bottom-center {
            content: "Page " counter(page) " of " counter(pages);
            font-size: 10pt;
            color: #666;
        }
    }
    
    body {
        font-family: 'Arial', sans-serif;
        line-height: 1.6;
        color: #333;
        font-size: 11pt;
    }
    
    h1 {
        color: #d32f2f;
        border-bottom: 3px solid #d32f2f;
        padding-bottom: 10px;
        margin-top: 30px;
        font-size: 24pt;
    }
    
    h2 {
        color: #1976d2;
        border-bottom: 2px solid #1976d2;
        padding-bottom: 5px;
        margin-top: 25px;
        font-size: 18pt;
    }
    
    h3 {
        color: #388e3c;
        margin-top: 20px;
        font-size: 14pt;
    }
    
    h4 {
        color: #f57c00;
        margin-top: 15px;
        font-size: 12pt;
    }
    
    code {
        background-color: #f5f5f5;
        padding: 2px 4px;
        border-radius: 3px;
        font-family: 'Courier New', monospace;
        font-size: 10pt;
    }
    
    pre {
        background-color: #f8f8f8;
        border: 1px solid #ddd;
        border-radius: 5px;
        padding: 15px;
        overflow-x: auto;
        font-family: 'Courier New', monospace;
        font-size: 9pt;
    }
    
    blockquote {
        border-left: 4px solid #d32f2f;
        margin: 20px 0;
        padding-left: 20px;
        background-color: #fafafa;
        padding: 15px 20px;
    }
    
    table {
        border-collapse: collapse;
        width: 100%;
        margin: 15px 0;
    }
    
    th, td {
        border: 1px solid #ddd;
        padding: 8px;
        text-align: left;
    }
    
    th {
        background-color: #f2f2f2;
        font-weight: bold;
    }
    
    ul, ol {
        margin: 10px 0;
        padding-left: 25px;
    }
    
    li {
        margin: 5px 0;
    }
    
    .page-break {
        page-break-before: always;
    }
    
    strong {
        color: #d32f2f;
        font-weight: bold;
    }
    
    em {
        color: #1976d2;
        font-style: italic;
    }
    """
    
    # Complete HTML document
    html_document = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Road Anomaly Detection System - Project Analysis</title>
    </head>
    <body>
        {html_content}
    </body>
    </html>
    """
    
    # Generate PDF
    font_config = FontConfiguration()
    html_doc = HTML(string=html_document)
    css_doc = CSS(string=css_content, font_config=font_config)
    
    html_doc.write_pdf(output_pdf, stylesheets=[css_doc], font_config=font_config)
    print(f"PDF generated successfully: {output_pdf}")

if __name__ == "__main__":
    markdown_file = "Road_Anomaly_Detection_Project_Analysis.md"
    output_pdf = "Road_Anomaly_Detection_Project_Analysis.pdf"
    
    if os.path.exists(markdown_file):
        try:
            markdown_to_pdf(markdown_file, output_pdf)
        except ImportError as e:
            print("Required packages not installed. Installing...")
            import subprocess
            subprocess.check_call(["pip", "install", "markdown", "weasyprint"])
            markdown_to_pdf(markdown_file, output_pdf)
    else:
        print(f"Markdown file not found: {markdown_file}")