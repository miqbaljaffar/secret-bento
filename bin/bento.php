<?php

require_once 'connect_db.php';
require_once 'const.php';

class BentoService {
    private $conn;

    public function __construct() {
        $this->conn = connectDB(DB_NAME_HANDOVER);
        if (!$this->conn) {
            error_log("Failed to connect to the database.");
            die("Error: Unable to connect to the database.");
        }
    }

    public function __destruct() {
        if ($this->conn) {
            $this->conn->close();
        }
    }

    public function getDailyOrderList(array $params): array {
        $date = $params['date'] ?? null;
        if (!$date) {
            return [];
        }

        $sql = "SELECT id_order, dt_order, id_worker, id_menu, n_amount 
                FROM t_orders 
                WHERE dt_order = ?";
        
        return $this->executeQuery($sql, "s", [$date]);
    }

    public function getMonthlyOrderList(array $params): array {
        $ym = $params['ym'] ?? null;
        if (!$ym) {
            return [];
        }

        $worker = $params['worker'] ?? null;
        $startDate = $ym . "-01";
        $endDate = date("Y-m-t", strtotime($startDate));

        $sql = "SELECT id_order, dt_order, id_worker, id_menu, n_amount 
                FROM t_orders 
                WHERE dt_order BETWEEN ? AND ?";
        
        $types = "ss";
        $queryParams = [$startDate, $endDate];

        if (!empty($worker)) {
            $sql .= " AND id_worker = ?";
            $types .= "s";
            $queryParams[] = $worker;
        }

        return $this->executeQuery($sql, $types, $queryParams);
    }

    public function getOrderSum(array $params): array {
        $ym = $params['ym'] ?? null;
        if (!$ym) {
            return [];
        }

        $startDate = $ym . "-01";
        $endDate = date("Y-m-t", strtotime($startDate));

        $sql = "SELECT id_worker, SUM(n_amount) AS total_orders
                FROM t_orders
                WHERE dt_order BETWEEN ? AND ?
                GROUP BY id_worker";

        return $this->executeQuery($sql, "ss", [$startDate, $endDate]);
    }

    public function getMenuList(array $params): array {
        $ym = $params['ym'] ?? null;
        if (!$ym) {
            return [];
        }

        $startDate = $ym . "-01";
        $endDate = date("Y-m-t", strtotime($startDate));

        $sql = "SELECT m.id_menu, m.menu_name, SUM(o.n_amount) AS total_ordered
                FROM t_orders o
                JOIN t_menu m ON o.id_menu = m.id_menu
                WHERE o.dt_order BETWEEN ? AND ?
                GROUP BY m.id_menu, m.menu_name
                ORDER BY total_ordered DESC";

        return $this->executeQuery($sql, "ss", [$startDate, $endDate]);
    }

    public function updateMenuData(array $params): bool {
        $menuId = $params['id'] ?? null;
        if (!$menuId) {
            return false;
        }

        $fields = [];
        $values = [];
        $types = "";

        if (isset($params['menu'])) {
            $fields[] = "menu_name = ?";
            $values[] = $params['menu'];
            $types .= "s";
        }
        if (isset($params['price'])) {
            $fields[] = "n_price = ?";
            $values[] = $params['price'];
            $types .= "d";
        }
        if (isset($params['date'])) {
            $fields[] = "dt_updated = ?";
            $values[] = $params['date'];
            $types .= "s";
        }

        if (empty($fields)) {
            return false; 
        }

        $sql = "UPDATE t_menu SET " . implode(", ", $fields) . " WHERE id_menu = ?";
        $values[] = $menuId;
        $types .= "i";

        return $this->executeQuery($sql, $types, $values, false);
    }

    public function updateOrderData(array $params): bool {
        $orderId = $params['id'] ?? null;
        $worker = $params['worker'] ?? null;
        $menu = $params['menu'] ?? null;
        $amount = $params['amount'] ?? null;

        if (!$orderId || !$worker || !$menu || !$amount) {
            return false;
        }

        $sql = "UPDATE t_orders 
                SET id_worker = ?, id_menu = ?, n_amount = ?, dt_order = CURRENT_DATE() 
                WHERE id_order = ?";

        return $this->executeQuery($sql, "siii", [$worker, $menu, $amount, $orderId], false);
    }

    private function executeQuery(string $sql, string $types, array $params, bool $isSelect = true) {
        $stmt = $this->conn->prepare($sql);
        if ($stmt === false) {
            error_log("Prepare failed: " . $this->conn->error);
            return $isSelect ? [] : false;
        }

        if (!empty($types) && !empty($params)) {
            $stmt->bind_param($types, ...$params);
        }

        $success = $stmt->execute();

        if (!$success) {
            error_log("Execute failed: " . $stmt->error);
            $stmt->close();
            return $isSelect ? [] : false;
        }

        if ($isSelect) {
            $result = $stmt->get_result();
            $data = $result->fetch_all(MYSQLI_ASSOC);
            $stmt->close();
            return $data;
        }

        $stmt->close();
        return $success;
    }
}