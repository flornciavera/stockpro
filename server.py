# ============================================================
#  STOCKPRO — Servidor Flask + Base de datos SQLite
# ============================================================

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import sqlite3
import os
import io
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT

app = Flask(__name__)
CORS(app)  # Permite que la página web se comunique con el servidor

DB = 'inventario.db'  # Nombre del archivo de base de datos

# ============================================================
#  BASE DE DATOS — Crear tablas si no existen
# ============================================================

def init_db():
    con = sqlite3.connect(DB)
    cur = con.cursor()

    # Tabla de productos
    cur.execute('''
        CREATE TABLE IF NOT EXISTS productos (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre    TEXT    NOT NULL,
            sku       TEXT,
            categoria TEXT,
            precio    REAL    NOT NULL,
            costo     REAL    DEFAULT 0,
            stock     INTEGER NOT NULL DEFAULT 0,
            stock_min INTEGER DEFAULT 5,
            unidad    TEXT    DEFAULT 'Unidad',
            descripcion TEXT  DEFAULT ''
        )
    ''')

    # Tabla de ventas
    cur.execute('''
        CREATE TABLE IF NOT EXISTS ventas (
            id       INTEGER PRIMARY KEY AUTOINCREMENT,
            prod_id  INTEGER NOT NULL,
            cantidad INTEGER NOT NULL,
            precio   REAL    NOT NULL,
            fecha    TEXT    NOT NULL,
            FOREIGN KEY (prod_id) REFERENCES productos(id)
        )
    ''')

    # Datos de ejemplo (solo si la tabla está vacía)
    cur.execute('SELECT COUNT(*) FROM productos')
    if cur.fetchone()[0] == 0:
        productos_ejemplo = [
            ('Coca-Cola 600ml',       'BEB-001', 'Bebidas',   18.50, 10.00, 45, 5,  'Unidad',    ''),
            ('Jabón Zote',            'LIM-001', 'Limpieza',  25.00, 15.00, 3,  5,  'Unidad',    ''),
            ('Arroz 1kg',             'ALI-001', 'Alimentos', 32.00, 20.00, 28, 10, 'Kilogramo', ''),
            ('Cuaderno 100 hojas',    'PAP-001', 'Papelería', 45.00, 28.00, 2,  5,  'Unidad',    ''),
            ('Shampoo Head & Shoulders','HIG-001','Higiene',  89.00, 55.00, 12, 5,  'Unidad',    ''),
            ('Aceite Vegetal 1L',     'ALI-002', 'Alimentos', 42.00, 28.00, 4,  6,  'Litro',     ''),
            ('Papel Higiénico 4 rollos','HIG-002','Higiene',  35.00, 20.00, 18, 8,  'Paquete',   ''),
            ('Galletas Marías',       'ALI-003', 'Alimentos', 15.00, 8.00,  30, 10, 'Paquete',   ''),
        ]
        cur.executemany('''
            INSERT INTO productos (nombre, sku, categoria, precio, costo, stock, stock_min, unidad, descripcion)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', productos_ejemplo)

    cur.execute('SELECT COUNT(*) FROM ventas')
    if cur.fetchone()[0] == 0:
        ventas_ejemplo = [
            (1, 3, 18.50, '2026-05-03 07:30:00'),
            (3, 2, 32.00, '2026-05-02 11:15:00'),
            (5, 1, 89.00, '2026-05-02 06:00:00'),
            (8, 5, 15.00, '2026-05-01 13:45:00'),
            (7, 2, 35.00, '2026-04-30 08:20:00'),
            (1, 6, 18.50, '2026-04-29 10:00:00'),
        ]
        cur.executemany('''
            INSERT INTO ventas (prod_id, cantidad, precio, fecha)
            VALUES (?, ?, ?, ?)
        ''', ventas_ejemplo)


    # Tabla de proveedores
    cur.execute('''
        CREATE TABLE IF NOT EXISTS proveedores (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre    TEXT    NOT NULL,
            contacto  TEXT    DEFAULT '',
            telefono  TEXT    DEFAULT '',
            email     TEXT    DEFAULT '',
            categoria TEXT    DEFAULT '',
            notas     TEXT    DEFAULT ''
        )
    ''')

    # Datos de ejemplo de proveedores
    cur.execute('SELECT COUNT(*) FROM proveedores')
    if cur.fetchone()[0] == 0:
        proveedores_ejemplo = [
            ('Distribuidora Norte', 'Carlos Mendez',  '3874-123456', 'carlos@dnorte.com',  'Alimentos', 'Entrega los lunes'),
            ('Bebidas del Sur',     'Ana Lopez',      '3874-654321', 'ana@bebidasur.com',  'Bebidas',   'Pago a 30 dias'),
            ('Limpieza Total',      'Pedro Ruiz',     '3874-111222', 'pedro@limpiezat.com','Limpieza',  'Descuento por volumen'),
        ]
        cur.executemany('''
            INSERT INTO proveedores (nombre, contacto, telefono, email, categoria, notas)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', proveedores_ejemplo)

    con.commit()
    con.close()


def get_db():
    """Devuelve una conexión a la base de datos."""
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row  # Para acceder a columnas por nombre
    return con


# ============================================================
#  RUTAS — PRODUCTOS
# ============================================================

@app.route('/api/productos', methods=['GET'])
def listar_productos():
    """Devuelve todos los productos."""
    con = get_db()
    productos = con.execute('SELECT * FROM productos ORDER BY id').fetchall()
    con.close()
    return jsonify([dict(p) for p in productos])


@app.route('/api/productos', methods=['POST'])
def crear_producto():
    """Crea un nuevo producto."""
    datos = request.json
    con = get_db()
    cur = con.execute('''
        INSERT INTO productos (nombre, sku, categoria, precio, costo, stock, stock_min, unidad, descripcion)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        datos.get('nombre'),
        datos.get('sku', ''),
        datos.get('categoria', 'Otros'),
        datos.get('precio', 0),
        datos.get('costo', 0),
        datos.get('stock', 0),
        datos.get('stock_min', 5),
        datos.get('unidad', 'Unidad'),
        datos.get('descripcion', ''),
    ))
    con.commit()
    nuevo_id = cur.lastrowid
    producto = con.execute('SELECT * FROM productos WHERE id = ?', (nuevo_id,)).fetchone()
    con.close()
    return jsonify(dict(producto)), 201


@app.route('/api/productos/<int:id>', methods=['PUT'])
def actualizar_producto(id):
    """Actualiza un producto existente."""
    datos = request.json
    con = get_db()
    con.execute('''
        UPDATE productos
        SET nombre=?, sku=?, categoria=?, precio=?, costo=?, stock=?, stock_min=?, unidad=?, descripcion=?
        WHERE id=?
    ''', (
        datos.get('nombre'),
        datos.get('sku', ''),
        datos.get('categoria', 'Otros'),
        datos.get('precio', 0),
        datos.get('costo', 0),
        datos.get('stock', 0),
        datos.get('stock_min', 5),
        datos.get('unidad', 'Unidad'),
        datos.get('descripcion', ''),
        id,
    ))
    con.commit()
    producto = con.execute('SELECT * FROM productos WHERE id = ?', (id,)).fetchone()
    con.close()
    return jsonify(dict(producto))


@app.route('/api/productos/<int:id>', methods=['DELETE'])
def eliminar_producto(id):
    """Elimina un producto."""
    con = get_db()
    con.execute('DELETE FROM productos WHERE id = ?', (id,))
    con.commit()
    con.close()
    return jsonify({'mensaje': 'Producto eliminado'})


# ============================================================
#  RUTAS — VENTAS
# ============================================================

@app.route('/api/ventas', methods=['GET'])
def listar_ventas():
    """Devuelve todas las ventas con el nombre del producto."""
    con = get_db()
    ventas = con.execute('''
        SELECT v.*, p.nombre as prod_nombre
        FROM ventas v
        LEFT JOIN productos p ON v.prod_id = p.id
        ORDER BY v.fecha DESC
    ''').fetchall()
    con.close()
    return jsonify([dict(v) for v in ventas])


@app.route('/api/ventas', methods=['POST'])
def crear_venta():
    """Registra una nueva venta y descuenta el stock."""
    datos = request.json
    prod_id  = datos.get('prod_id')
    cantidad = datos.get('cantidad', 1)
    precio   = datos.get('precio', 0)

    from datetime import datetime
    fecha = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    con = get_db()

    # Descontar stock del producto
    con.execute('UPDATE productos SET stock = MAX(0, stock - ?) WHERE id = ?', (cantidad, prod_id))

    # Registrar la venta
    cur = con.execute('''
        INSERT INTO ventas (prod_id, cantidad, precio, fecha)
        VALUES (?, ?, ?, ?)
    ''', (prod_id, cantidad, precio, fecha))
    con.commit()

    nueva_id = cur.lastrowid
    venta = con.execute('''
        SELECT v.*, p.nombre as prod_nombre
        FROM ventas v LEFT JOIN productos p ON v.prod_id = p.id
        WHERE v.id = ?
    ''', (nueva_id,)).fetchone()
    con.close()
    return jsonify(dict(venta)), 201


@app.route('/api/ventas/<int:id>', methods=['DELETE'])
def eliminar_venta(id):
    """Elimina una venta."""
    con = get_db()
    con.execute('DELETE FROM ventas WHERE id = ?', (id,))
    con.commit()
    con.close()
    return jsonify({'mensaje': 'Venta eliminada'})


# ============================================================
#  RUTA — DASHBOARD (datos resumidos)
# ============================================================

@app.route('/api/dashboard', methods=['GET'])
def dashboard():
    """Devuelve los datos resumidos para el dashboard."""
    con = get_db()

    productos = con.execute('SELECT * FROM productos').fetchall()
    ventas    = con.execute('SELECT * FROM ventas').fetchall()

    total_productos = len(productos)
    stock_bajo      = sum(1 for p in productos if p['stock'] <= p['stock_min'])
    valor_stock     = sum(p['precio'] * p['stock'] for p in productos)
    costo_stock     = sum(p['costo']  * p['stock'] for p in productos)

    total_ingresos  = sum(v['cantidad'] * v['precio'] for v in ventas)
    total_costos    = 0
    for v in ventas:
        p = next((x for x in productos if x['id'] == v['prod_id']), None)
        if p:
            total_costos += p['costo'] * v['cantidad']
    ganancia = total_ingresos - total_costos

    con.close()
    return jsonify({
        'total_productos': total_productos,
        'stock_bajo':      stock_bajo,
        'valor_stock':     round(valor_stock, 2),
        'costo_stock':     round(costo_stock, 2),
        'total_ingresos':  round(total_ingresos, 2),
        'ganancia':        round(ganancia, 2),
    })



# ============================================================
#  RUTAS — PROVEEDORES
# ============================================================

@app.route('/api/proveedores', methods=['GET'])
def listar_proveedores():
    con = get_db()
    proveedores = con.execute('SELECT * FROM proveedores ORDER BY nombre').fetchall()
    con.close()
    return jsonify([dict(p) for p in proveedores])

@app.route('/api/proveedores', methods=['POST'])
def crear_proveedor():
    datos = request.json
    con = get_db()
    cur = con.execute('''
        INSERT INTO proveedores (nombre, contacto, telefono, email, categoria, notas)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (datos.get('nombre'), datos.get('contacto',''), datos.get('telefono',''),
          datos.get('email',''), datos.get('categoria',''), datos.get('notas','')))
    con.commit()
    nuevo = con.execute('SELECT * FROM proveedores WHERE id = ?', (cur.lastrowid,)).fetchone()
    con.close()
    return jsonify(dict(nuevo)), 201

@app.route('/api/proveedores/<int:id>', methods=['PUT'])
def actualizar_proveedor(id):
    datos = request.json
    con = get_db()
    con.execute('''
        UPDATE proveedores SET nombre=?, contacto=?, telefono=?, email=?, categoria=?, notas=?
        WHERE id=?
    ''', (datos.get('nombre'), datos.get('contacto',''), datos.get('telefono',''),
          datos.get('email',''), datos.get('categoria',''), datos.get('notas',''), id))
    con.commit()
    prov = con.execute('SELECT * FROM proveedores WHERE id = ?', (id,)).fetchone()
    con.close()
    return jsonify(dict(prov))

@app.route('/api/proveedores/<int:id>', methods=['DELETE'])
def eliminar_proveedor(id):
    con = get_db()
    con.execute('DELETE FROM proveedores WHERE id = ?', (id,))
    con.commit()
    con.close()
    return jsonify({'mensaje': 'Proveedor eliminado'})

# ============================================================
#  RUTA — GENERAR PDF
# ============================================================

@app.route('/api/reporte/pdf', methods=['GET'])
def generar_pdf():
    """Genera un reporte PDF del mes indicado."""
    mes  = request.args.get('mes', datetime.now().month, type=int)
    anio = request.args.get('anio', datetime.now().year, type=int)

    con = get_db()
    productos_db = con.execute('SELECT * FROM productos').fetchall()
    ventas_db    = con.execute('''
        SELECT v.*, p.nombre as prod_nombre, p.costo as prod_costo
        FROM ventas v LEFT JOIN productos p ON v.prod_id = p.id
        WHERE strftime('%m', v.fecha) = ? AND strftime('%Y', v.fecha) = ?
        ORDER BY v.fecha DESC
    ''', (str(mes).zfill(2), str(anio))).fetchall()
    con.close()

    # Calcular totales
    ingresos = sum(v['cantidad'] * v['precio'] for v in ventas_db)
    costos   = sum(v['cantidad'] * (v['prod_costo'] or 0) for v in ventas_db)
    ganancia = ingresos - costos
    valor_stock = sum(p['stock'] * p['precio'] for p in productos_db)

    meses_nombres = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio',
                     'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

    # Crear PDF en memoria
    buffer = io.BytesIO()
    doc    = SimpleDocTemplate(buffer, pagesize=A4,
                               leftMargin=2*cm, rightMargin=2*cm,
                               topMargin=2*cm, bottomMargin=2*cm)

    styles = getSampleStyleSheet()
    rojo   = colors.HexColor('#e53935')
    oscuro = colors.HexColor('#1a1a1a')
    gris   = colors.HexColor('#555555')

    titulo_style = ParagraphStyle('titulo', fontSize=22, textColor=rojo, spaceAfter=4, fontName='Helvetica-Bold')
    sub_style    = ParagraphStyle('sub',    fontSize=11, textColor=gris, spaceAfter=2)
    seccion_style= ParagraphStyle('sec',    fontSize=13, textColor=oscuro, spaceBefore=16, spaceAfter=8, fontName='Helvetica-Bold')

    elementos = []

    # Encabezado
    elementos.append(Paragraph('StockPro', titulo_style))
    elementos.append(Paragraph(f'Reporte mensual — {meses_nombres[mes]} {anio}', sub_style))
    elementos.append(Paragraph(f'Generado el {datetime.now().strftime("%d/%m/%Y %H:%M")}', sub_style))
    elementos.append(Spacer(1, 0.5*cm))

    # Resumen general
    elementos.append(Paragraph('Resumen del mes', seccion_style))
    resumen_data = [
        ['Concepto', 'Valor'],
        ['Ingresos totales',   f'${ingresos:.2f}'],
        ['Costos totales',     f'${costos:.2f}'],
        ['Ganancia neta',      f'${ganancia:.2f}'],
        ['Transacciones',      str(len(ventas_db))],
        ['Valor del inventario', f'${valor_stock:.2f}'],
    ]
    tabla_resumen = Table(resumen_data, colWidths=[10*cm, 6*cm])
    tabla_resumen.setStyle(TableStyle([
        ('BACKGROUND',   (0,0), (-1,0),  rojo),
        ('TEXTCOLOR',    (0,0), (-1,0),  colors.white),
        ('FONTNAME',     (0,0), (-1,0),  'Helvetica-Bold'),
        ('FONTSIZE',     (0,0), (-1,-1), 11),
        ('ALIGN',        (1,0), (1,-1),  'RIGHT'),
        ('ROWBACKGROUNDS',(0,1),(-1,-1), [colors.HexColor('#f9f9f9'), colors.white]),
        ('GRID',         (0,0), (-1,-1), 0.5, colors.HexColor('#dddddd')),
        ('PADDING',      (0,0), (-1,-1), 8),
        ('FONTNAME',     (0,3), (0,3),   'Helvetica-Bold'),
        ('TEXTCOLOR',    (1,3), (1,3),   rojo),
    ]))
    elementos.append(tabla_resumen)

    # Detalle de ventas
    elementos.append(Paragraph('Detalle de ventas', seccion_style))
    if ventas_db:
        ventas_data = [['Producto', 'Cantidad', 'Precio unit.', 'Total', 'Fecha']]
        for v in ventas_db:
            fecha = v['fecha'][:10] if v['fecha'] else '—'
            ventas_data.append([
                v['prod_nombre'] or 'Desconocido',
                str(v['cantidad']),
                f"${v['precio']:.2f}",
                f"${v['cantidad'] * v['precio']:.2f}",
                fecha,
            ])
        tabla_ventas = Table(ventas_data, colWidths=[6*cm, 2.5*cm, 2.5*cm, 2.5*cm, 3*cm])
        tabla_ventas.setStyle(TableStyle([
            ('BACKGROUND',    (0,0), (-1,0),  rojo),
            ('TEXTCOLOR',     (0,0), (-1,0),  colors.white),
            ('FONTNAME',      (0,0), (-1,0),  'Helvetica-Bold'),
            ('FONTSIZE',      (0,0), (-1,-1), 10),
            ('ALIGN',         (1,0), (-1,-1), 'CENTER'),
            ('ROWBACKGROUNDS',(0,1), (-1,-1), [colors.HexColor('#f9f9f9'), colors.white]),
            ('GRID',          (0,0), (-1,-1), 0.5, colors.HexColor('#dddddd')),
            ('PADDING',       (0,0), (-1,-1), 7),
        ]))
        elementos.append(tabla_ventas)
    else:
        elementos.append(Paragraph('No hubo ventas en este período.', sub_style))

    # Inventario actual
    elementos.append(Paragraph('Estado del inventario', seccion_style))
    inv_data = [['Producto', 'Categoría', 'Stock', 'Precio', 'Valor']]
    for p in productos_db:
        inv_data.append([
            p['nombre'],
            p['categoria'],
            f"{p['stock']} {p['unidad']}",
            f"${p['precio']:.2f}",
            f"${p['stock'] * p['precio']:.2f}",
        ])
    tabla_inv = Table(inv_data, colWidths=[6*cm, 3*cm, 2.5*cm, 2.5*cm, 2.5*cm])
    tabla_inv.setStyle(TableStyle([
        ('BACKGROUND',    (0,0), (-1,0),  oscuro),
        ('TEXTCOLOR',     (0,0), (-1,0),  colors.white),
        ('FONTNAME',      (0,0), (-1,0),  'Helvetica-Bold'),
        ('FONTSIZE',      (0,0), (-1,-1), 10),
        ('ALIGN',         (2,0), (-1,-1), 'CENTER'),
        ('ROWBACKGROUNDS',(0,1), (-1,-1), [colors.HexColor('#f9f9f9'), colors.white]),
        ('GRID',          (0,0), (-1,-1), 0.5, colors.HexColor('#dddddd')),
        ('PADDING',       (0,0), (-1,-1), 7),
    ]))
    elementos.append(tabla_inv)

    doc.build(elementos)
    buffer.seek(0)
    nombre_archivo = f'reporte_{meses_nombres[mes].lower()}_{anio}.pdf'
    return send_file(buffer, mimetype='application/pdf',
                     as_attachment=True, download_name=nombre_archivo)


# ============================================================
#  INICIO
# ============================================================

if __name__ == '__main__':
    init_db()
    print('='*50)
    print('  STOCKPRO — Servidor corriendo!')
    print('  Abrí: http://localhost:5000')
    print('='*50)
    app.run(debug=True, port=5000)